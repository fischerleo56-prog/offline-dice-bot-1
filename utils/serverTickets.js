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

const staffAccessFieldName = "Staff with ticket access";
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

function buildPanel(staffRoleIds) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 Support & Reports")
        .setDescription(
            "Choose what you need help with below. The bot will create a private ticket channel " +
            "where you can talk directly with the server team. Please write in English."
        )
        .addFields({
            name: "Please note",
            value: "Describe your request clearly. Only you, the selected staff roles, and server administrators can see your ticket."
        }, {
            name: staffAccessFieldName,
            value: staffRoleIds.map(roleId => `<@&${roleId}>`).join(", ")
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

function getPanelStaffRoleIds(panelMessage) {
    const field = panelMessage.embeds[0]?.fields.find(item => item.name === staffAccessFieldName);
    return [...(field?.value || "").matchAll(/<@&(\d+)>/g)].map(match => match[1]);
}

function buildTicketModal(type, panelMessageId) {
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
        .setCustomId(`server-ticket:submit:${type}:${panelMessageId}`)
        .setTitle(details.modalTitle)
        .addComponents(
            new ActionRowBuilder().addComponents(subject),
            new ActionRowBuilder().addComponents(description),
            new ActionRowBuilder().addComponents(target)
        );
}

function makeTicketTopic(ownerId, type, staffRoleIds, status = "open") {
    return `server-ticket|owner=${ownerId}|type=${type}|roles=${staffRoleIds.join(",")}|status=${status}`;
}

function readTicketTopic(channel) {
    const match = /^server-ticket\|owner=(\d+)\|type=([a-z_]+)\|roles=([\d,]+)\|status=(open|closed)$/.exec(channel.topic || "");
    if (!match) return null;
    return {
        ownerId: match[1],
        type: match[2],
        staffRoleIds: match[3].split(","),
        status: match[4]
    };
}

function buildTicketControls() {
    const button = new ButtonBuilder()
        .setCustomId("server-ticket:close")
        .setLabel("Close & delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger);

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

async function handlePanelButton(interaction) {
    const [, action, type] = interaction.customId.split(":");

    if (action === "open") {
        if (!interaction.guild || !ticketTypes[type]) {
            return interaction.reply({ content: "❌ This ticket panel is invalid.", ephemeral: true });
        }

        return interaction.showModal(buildTicketModal(type, interaction.message.id));
    }

    if (action === "close") return closeTicket(interaction);
}

async function handleTicketModal(interaction) {
    const [, action, type, panelMessageId] = interaction.customId.split(":");
    if (action !== "submit" || !interaction.guild || !ticketTypes[type] || !panelMessageId) {
        return interaction.reply({ content: "❌ This ticket form is invalid.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const panelMessage = await interaction.channel.messages.fetch(panelMessageId);
        const staffRoleIds = getPanelStaffRoleIds(panelMessage);
        const staffRoles = staffRoleIds
            .map(roleId => interaction.guild.roles.cache.get(roleId))
            .filter(Boolean);
        if (!staffRoleIds.length || staffRoles.length !== staffRoleIds.length) {
            return interaction.editReply("❌ The staff roles for this panel are unavailable. Please post a new panel with `/ticketpanel`.");
        }

        const existing = await findExistingTicket(interaction.guild, interaction.user.id, type);
        if (existing) {
            return interaction.editReply(`You already have an open ticket for this topic: <#${existing.id}>`);
        }

        const guild = interaction.guild;
        const botMember = guild.members.me || await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply("❌ The bot needs the **Manage Channels** permission to create tickets.");
        }

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
            topic: makeTicketTopic(interaction.user.id, type, staffRoleIds),
            permissionOverwrites
        });

        const subject = interaction.fields.getTextInputValue("ticket_subject").trim();
        const description = interaction.fields.getTextInputValue("ticket_description").trim();
        const target = interaction.fields.getTextInputValue("ticket_target").trim();
        const staffMentions = staffRoleIds.map(roleId => `<@&${roleId}>`).join(" ");
        await channel.send({
            content: `${staffMentions} <@${interaction.user.id}> Your ticket is open. The server team can reply here.`,
            embeds: [buildOpeningEmbed(type, interaction.user.id, subject, description, target)],
            components: buildTicketControls(),
            allowedMentions: {
                users: [interaction.user.id],
                roles: staffRoleIds
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
    const permissions = interaction.memberPermissions || interaction.member?.permissions;
    const hasStaffRole = interaction.member?.roles?.cache?.some(role => ticket.staffRoleIds.includes(role.id));
    const canManageTicket = permissions?.has(PermissionFlagsBits.Administrator) ||
        permissions?.has(PermissionFlagsBits.ManageChannels) || hasStaffRole;
    if (interaction.user.id !== ticket.ownerId && !canManageTicket) {
        return interaction.reply({ content: "Only the ticket creator or server staff can close this ticket.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    await channel.setTopic(makeTicketTopic(ticket.ownerId, ticket.type, ticket.staffRoleIds, "closed"));
    await channel.send(`🗑️ Ticket closed by <@${interaction.user.id}>. This channel will be deleted in 5 seconds.`);
    await interaction.editReply("✅ This ticket is closed and will be permanently deleted in 5 seconds.");

    setTimeout(() => {
        channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(error => {
            console.error("❌ Could not delete closed ticket:", error);
        });
    }, 5000);
}

module.exports = {
    buildPanel,
    handlePanelButton,
    handleTicketModal
};
