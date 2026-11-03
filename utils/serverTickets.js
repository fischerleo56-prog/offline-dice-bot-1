const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const staffRolePattern = /\b(owner|admin|moderator|mod|support|staff|helper|ticket team)\b/i;
const ticketTypes = {
    support: {
        label: "Support",
        emoji: "🛠️",
        channelPrefix: "support",
        modalTitle: "Support-Ticket erstellen"
    },
    person_report: {
        label: "Person melden",
        emoji: "🚨",
        channelPrefix: "person-melden",
        modalTitle: "Person melden"
    },
    server_report: {
        label: "Serverproblem melden",
        emoji: "⚠️",
        channelPrefix: "server-melden",
        modalTitle: "Serverproblem melden"
    },
    other: {
        label: "Sonstiges",
        emoji: "✉️",
        channelPrefix: "sonstiges",
        modalTitle: "Sonstiges Ticket"
    }
};

function buildPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 Support & Meldungen")
        .setDescription(
            "Wähle unten aus, worum es geht. Der Bot erstellt einen privaten Ticket-Channel, " +
            "in dem du direkt mit dem Serverteam schreiben kannst."
        )
        .addFields({
            name: "Bitte beachten",
            value: "Beschreibe dein Anliegen möglichst genau. Nur du und das zuständige Team können dein Ticket sehen."
        })
        .setFooter({ text: "Ein Ticket kannst du jederzeit selbst schließen." });

    const buttons = Object.entries(ticketTypes).map(([type, details]) =>
        new ButtonBuilder()
            .setCustomId(`server-ticket:open:${type}`)
            .setLabel(details.label)
            .setEmoji(details.emoji)
            .setStyle(type === "person_report" ? ButtonStyle.Danger : ButtonStyle.Primary)
    );

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(buttons)]
    };
}

function buildTicketModal(type) {
    const details = ticketTypes[type];
    if (!details) throw new Error(`Unbekannter Ticket-Typ: ${type}`);

    const subject = new TextInputBuilder()
        .setCustomId("ticket_subject")
        .setLabel("Kurzer Titel")
        .setPlaceholder("Worum geht es?")
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(100)
        .setRequired(true);

    const description = new TextInputBuilder()
        .setCustomId("ticket_description")
        .setLabel("Beschreibung")
        .setPlaceholder("Erkläre kurz, was passiert ist oder wobei du Hilfe brauchst.")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

    const target = new TextInputBuilder()
        .setCustomId("ticket_target")
        .setLabel("Person, Channel oder Bereich (optional)")
        .setPlaceholder("Zum Beispiel @Nutzer oder #Channel")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false);

    return new ModalBuilder()
        .setCustomId(`server-ticket:submit:${type}`)
        .setTitle(details.modalTitle)
        .addComponents(
            new ActionRowBuilder().addComponents(subject),
            new ActionRowBuilder().addComponents(description),
            new ActionRowBuilder().addComponents(target)
        );
}

function getStaffRoles(guild) {
    return guild.roles.cache.filter(role =>
        role.id !== guild.roles.everyone.id &&
        (role.permissions.has(PermissionFlagsBits.Administrator) ||
            role.permissions.has(PermissionFlagsBits.ManageChannels) ||
            role.permissions.has(PermissionFlagsBits.ManageMessages) ||
            staffRolePattern.test(role.name))
    );
}

function isStaff(interaction) {
    const permissions = interaction.memberPermissions || interaction.member?.permissions;
    if (
        permissions?.has(PermissionFlagsBits.Administrator) ||
        permissions?.has(PermissionFlagsBits.ManageChannels) ||
        permissions?.has(PermissionFlagsBits.ManageMessages)
    ) {
        return true;
    }

    return Boolean(interaction.member?.roles?.cache?.some(role => staffRolePattern.test(role.name)));
}

function makeTicketTopic(ownerId, type, status = "open") {
    return `server-ticket|owner=${ownerId}|type=${type}|status=${status}`;
}

function readTicketTopic(channel) {
    const match = /^server-ticket\|owner=(\d+)\|type=([a-z_]+)\|status=(open|closed)$/.exec(channel.topic || "");
    if (!match) return null;
    return { ownerId: match[1], type: match[2], status: match[3] };
}

function buildTicketControls(action = "close") {
    const isClosed = action === "reopen";
    const button = new ButtonBuilder()
        .setCustomId(`server-ticket:${action}`)
        .setLabel(isClosed ? "Ticket wieder öffnen" : "Ticket schließen")
        .setEmoji(isClosed ? "🔓" : "🔒")
        .setStyle(isClosed ? ButtonStyle.Success : ButtonStyle.Secondary);

    return [new ActionRowBuilder().addComponents(button)];
}

function buildOpeningEmbed(type, ownerId, subject, description, target) {
    const details = ticketTypes[type];
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${details.emoji} ${details.label}: ${subject}`)
        .setDescription(description)
        .addFields({ name: "Erstellt von", value: `<@${ownerId}>`, inline: true })
        .setFooter({ text: "Das Ticketteam kann hier antworten. Mit dem Button kannst du schließen." })
        .setTimestamp();

    if (target) embed.addFields({ name: "Betroffene Person / Bereich", value: target });
    return embed;
}

async function findExistingTicket(guild, ownerId, type) {
    const channels = await guild.channels.fetch();
    return channels.find(channel => {
        if (!channel || channel.type !== ChannelType.GuildText) return false;
        const ticket = readTicketTopic(channel);
        return ticket?.ownerId === ownerId && ticket.type === type && ticket.status === "open";
    });
}

async function getTicketCategory(guild, staffRoles, botMember) {
    let category = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildCategory && channel.name === "🎫 TICKETS"
    );

    if (category) return category;

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        ...staffRoles.map(role => ({
            id: role.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
        })),
        {
            id: botMember.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
        }
    ];

    category = await guild.channels.create({
        name: "🎫 TICKETS",
        type: ChannelType.GuildCategory,
        permissionOverwrites
    });
    return category;
}

async function handlePanelButton(interaction) {
    const [, action, type] = interaction.customId.split(":");

    if (action === "open") {
        if (!interaction.guild || !ticketTypes[type]) {
            return interaction.reply({ content: "❌ Dieses Ticket-Panel ist ungültig.", ephemeral: true });
        }

        const existing = await findExistingTicket(interaction.guild, interaction.user.id, type);
        if (existing) {
            return interaction.reply({
                content: `Du hast für dieses Thema bereits ein offenes Ticket: <#${existing.id}>`,
                ephemeral: true
            });
        }

        return interaction.showModal(buildTicketModal(type));
    }

    if (action === "close") return closeTicket(interaction);
    if (action === "reopen") return reopenTicket(interaction);
}

async function handleTicketModal(interaction) {
    const [, action, type] = interaction.customId.split(":");
    if (action !== "submit" || !interaction.guild || !ticketTypes[type]) {
        return interaction.reply({ content: "❌ Dieses Ticketformular ist ungültig.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const existing = await findExistingTicket(interaction.guild, interaction.user.id, type);
        if (existing) {
            return interaction.editReply(`Du hast für dieses Thema bereits ein offenes Ticket: <#${existing.id}>`);
        }

        const guild = interaction.guild;
        const botMember = guild.members.me || await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply("❌ Der Bot braucht die Berechtigung **Kanäle verwalten**, um Tickets zu erstellen.");
        }

        const staffRoles = getStaffRoles(guild);
        const category = await getTicketCategory(guild, staffRoles, botMember);
        const permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            ...staffRoles.map(role => ({
                id: role.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            })),
            {
                id: botMember.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages
                ]
            }
        ];

        const username = interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .slice(0, 30) || "user";
        const channel = await guild.channels.create({
            name: `ticket-${ticketTypes[type].channelPrefix}-${username}`.slice(0, 100),
            type: ChannelType.GuildText,
            parent: category.id,
            topic: makeTicketTopic(interaction.user.id, type),
            permissionOverwrites
        });

        const subject = interaction.fields.getTextInputValue("ticket_subject").trim();
        const description = interaction.fields.getTextInputValue("ticket_description").trim();
        const target = interaction.fields.getTextInputValue("ticket_target").trim();
        const staffToNotify = [...staffRoles.values()].filter(role => staffRolePattern.test(role.name));
        const staffMentions = staffToNotify.map(role => `<@&${role.id}>`).join(" ");
        await channel.send({
            content: `${staffMentions} <@${interaction.user.id}> Dein Ticket ist eröffnet. Das Serverteam kann dir hier antworten.`,
            embeds: [buildOpeningEmbed(type, interaction.user.id, subject, description, target)],
            components: buildTicketControls(),
            allowedMentions: {
                users: [interaction.user.id],
                roles: staffToNotify.map(role => role.id)
            }
        });

        return interaction.editReply(`✅ Dein privates Ticket wurde erstellt: <#${channel.id}>`);
    } catch (error) {
        console.error("❌ Ticket konnte nicht erstellt werden:", error);
        return interaction.editReply("❌ Das Ticket konnte nicht erstellt werden. Prüfe, ob der Bot **Kanäle verwalten** darf.");
    }
}

async function closeTicket(interaction) {
    const ticket = readTicketTopic(interaction.channel);
    if (!ticket) {
        return interaction.reply({ content: "❌ Das ist kein Ticket-Channel.", ephemeral: true });
    }
    if (ticket.status !== "open") {
        return interaction.reply({ content: "Dieses Ticket ist bereits geschlossen.", ephemeral: true });
    }
    if (interaction.user.id !== ticket.ownerId && !isStaff(interaction)) {
        return interaction.reply({ content: "Nur der Ersteller oder das Serverteam kann dieses Ticket schließen.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(ticket.ownerId, {
        ViewChannel: false,
        SendMessages: false
    });
    if (!interaction.channel.name.startsWith("closed-")) {
        await interaction.channel.setName(`closed-${interaction.channel.name}`.slice(0, 100));
    }
    await interaction.channel.setTopic(makeTicketTopic(ticket.ownerId, ticket.type, "closed"));

    const embed = EmbedBuilder.from(interaction.message.embeds[0] || new EmbedBuilder().setTitle("Ticket"))
        .setFooter({ text: `Geschlossen von ${interaction.user.tag}` });
    await interaction.message.edit({ embeds: [embed], components: buildTicketControls("reopen") });
    await interaction.channel.send(`🔒 Ticket geschlossen von <@${interaction.user.id}>.`);
    return interaction.editReply("✅ Ticket geschlossen und für das Team archiviert.");
}

async function reopenTicket(interaction) {
    const ticket = readTicketTopic(interaction.channel);
    if (!ticket || ticket.status !== "closed") {
        return interaction.reply({ content: "❌ Dieses Ticket ist nicht geschlossen.", ephemeral: true });
    }
    if (!isStaff(interaction)) {
        return interaction.reply({ content: "Nur das Serverteam kann ein Ticket wieder öffnen.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(ticket.ownerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
    });
    if (interaction.channel.name.startsWith("closed-")) {
        await interaction.channel.setName(interaction.channel.name.slice("closed-".length));
    }
    await interaction.channel.setTopic(makeTicketTopic(ticket.ownerId, ticket.type, "open"));

    const embed = EmbedBuilder.from(interaction.message.embeds[0] || new EmbedBuilder().setTitle("Ticket"))
        .setFooter({ text: "Das Ticketteam kann hier antworten. Mit dem Button kannst du schließen." });
    await interaction.message.edit({ embeds: [embed], components: buildTicketControls() });
    await interaction.channel.send(`🔓 Ticket wieder geöffnet von <@${interaction.user.id}>.`);
    return interaction.editReply("✅ Ticket wieder geöffnet.");
}

module.exports = {
    buildPanel,
    handlePanelButton,
    handleTicketModal
};
