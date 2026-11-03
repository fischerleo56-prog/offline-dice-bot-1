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
        modalTitle: "Create a Support Ticket"
    },
    person_report: {
        label: "Report a User",
        emoji: "🚨",
        channelPrefix: "report-user",
        modalTitle: "Report a User"
    },
    server_report: {
        label: "Report a Server Issue",
        emoji: "⚠️",
        channelPrefix: "report-server",
        modalTitle: "Report a Server Issue"
    },
    other: {
        label: "Other",
        emoji: "✉️",
        channelPrefix: "other",
        modalTitle: "Other Request"
    }
};

function buildPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 Support & Reports")
        .setDescription(
            "Choose what you need help with below. The bot will create a private ticket channel " +
            "where you can talk directly with the server team. Please write in English."
        )
        .addFields({
            name: "Please note",
            value: "Describe your request clearly. Only you and the relevant staff team can see your ticket."
        })
        .setFooter({ text: "You can close your ticket at any time." });

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
    if (!details) throw new Error(`Unknown ticket type: ${type}`);

    const subject = new TextInputBuilder()
        .setCustomId("ticket_subject")
        .setLabel("Short title")
        .setPlaceholder("What is this about? Please write in English.")
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(100)
        .setRequired(true);

    const description = new TextInputBuilder()
        .setCustomId("ticket_description")
        .setLabel("Description")
        .setPlaceholder("Explain what happened or what help you need. Please write in English.")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

    const target = new TextInputBuilder()
        .setCustomId("ticket_target")
        .setLabel("Person, channel, or area (optional)")
        .setPlaceholder("For example, a username or channel name")
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
        .setLabel(isClosed ? "Reopen ticket" : "Close ticket")
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
        .addFields({ name: "Created by", value: `<@${ownerId}>`, inline: true })
        .setFooter({ text: "The support team can reply here. Use the button to close this ticket." })
        .setTimestamp();

    if (target) embed.addFields({ name: "Reported person / area", value: target });
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
            return interaction.reply({ content: "❌ This ticket panel is invalid.", ephemeral: true });
        }

        const existing = await findExistingTicket(interaction.guild, interaction.user.id, type);
        if (existing) {
            return interaction.reply({
                content: `You already have an open ticket for this topic: <#${existing.id}>`,
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
        return interaction.reply({ content: "❌ This ticket form is invalid.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const existing = await findExistingTicket(interaction.guild, interaction.user.id, type);
        if (existing) {
            return interaction.editReply(`You already have an open ticket for this topic: <#${existing.id}>`);
        }

        const guild = interaction.guild;
        const botMember = guild.members.me || await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply("❌ The bot needs the **Manage Channels** permission to create tickets.");
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
            content: `${staffMentions} <@${interaction.user.id}> Your ticket is open. The server team can reply here.`,
            embeds: [buildOpeningEmbed(type, interaction.user.id, subject, description, target)],
            components: buildTicketControls(),
            allowedMentions: {
                users: [interaction.user.id],
                roles: staffToNotify.map(role => role.id)
            }
        });

        return interaction.editReply(`✅ Your private ticket has been created: <#${channel.id}>`);
    } catch (error) {
        console.error("❌ Could not create ticket:", error);
        return interaction.editReply("❌ The ticket could not be created. Check that the bot has **Manage Channels** permission.");
    }
}

async function closeTicket(interaction) {
    const ticket = readTicketTopic(interaction.channel);
    if (!ticket) {
        return interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    }
    if (ticket.status !== "open") {
        return interaction.reply({ content: "This ticket is already closed.", ephemeral: true });
    }
    if (interaction.user.id !== ticket.ownerId && !isStaff(interaction)) {
        return interaction.reply({ content: "Only the ticket creator or server staff can close this ticket.", ephemeral: true });
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
        .setFooter({ text: `Closed by ${interaction.user.tag}` });
    await interaction.message.edit({ embeds: [embed], components: buildTicketControls("reopen") });
    await interaction.channel.send(`🔒 Ticket closed by <@${interaction.user.id}>.`);
    return interaction.editReply("✅ Ticket closed and archived for the team.");
}

async function reopenTicket(interaction) {
    const ticket = readTicketTopic(interaction.channel);
    if (!ticket || ticket.status !== "closed") {
        return interaction.reply({ content: "❌ This ticket is not closed.", ephemeral: true });
    }
    if (!isStaff(interaction)) {
        return interaction.reply({ content: "Only server staff can reopen a ticket.", ephemeral: true });
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
        .setFooter({ text: "The support team can reply here. Use the button to close this ticket." });
    await interaction.message.edit({ embeds: [embed], components: buildTicketControls() });
    await interaction.channel.send(`🔓 Ticket reopened by <@${interaction.user.id}>.`);
    return interaction.editReply("✅ Ticket reopened.");
}

module.exports = {
    buildPanel,
    handlePanelButton,
    handleTicketModal
};
