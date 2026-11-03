const fs = require("fs");
const path = require("path");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    LabelBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const dataDirectory = path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "ticket-applications.json");
let state;

const applicationQuestions = [
    {
        id: "liveFrequency",
        label: "Live frequency",
        question: "How often have you gone live on TikTok with Offline Dice?",
        style: TextInputStyle.Paragraph,
        minLength: 2
    },
    {
        id: "motivation",
        label: "Your motivation",
        question: "Why do you want to become a Top Streamer or VIP?",
        style: TextInputStyle.Paragraph,
        minLength: 10
    },
    {
        id: "goals",
        label: "Your goals",
        question: "What do you want to achieve as a Top Streamer or VIP?",
        style: TextInputStyle.Paragraph,
        minLength: 10
    },
    {
        id: "tiktokUsername",
        label: "TikTok username",
        question: "What is the TikTok username you use to go live?",
        style: TextInputStyle.Short,
        minLength: 2
    },
    {
        id: "typicalViewers",
        label: "Typical viewers",
        question: "How many viewers do you have during a typical stream?",
        style: TextInputStyle.Short,
        minLength: 1
    },
    {
        id: "trustProof",
        label: "Trust proof",
        question: "Do you have proof that you’re trustworthy?",
        style: TextInputStyle.Paragraph,
        minLength: 2
    }
];

function loadState() {
    if (state) return state;

    try {
        state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("❌ Ticket-Bewerbungen konnten nicht geladen werden:", error);
        }

        state = { guilds: {} };
    }

    if (!state.guilds || typeof state.guilds !== "object") state.guilds = {};
    return state;
}

function saveState() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(loadState(), null, 2), "utf8");
    fs.renameSync(temporaryFile, stateFile);
}

function getGuildState(guildId) {
    const currentState = loadState();
    if (!currentState.guilds[guildId]) currentState.guilds[guildId] = { channels: {} };
    if (!currentState.guilds[guildId].channels) currentState.guilds[guildId].channels = {};
    return currentState.guilds[guildId];
}

function getChannelState(guildId, channelId) {
    if (!guildId || !channelId) return null;
    return getGuildState(guildId).channels[channelId] || null;
}

function updateChannelState(guildId, channelId, updates) {
    const guild = getGuildState(guildId);
    const current = guild.channels[channelId] || {};
    guild.channels[channelId] = { ...current, ...updates };
    saveState();
    return guild.channels[channelId];
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\u2010-\u2015]/g, "-");
}

function detectApplicationType(channel, messages = []) {
    const parts = [channel?.name, channel?.topic, channel?.parent?.name];

    for (const message of messages) {
        parts.push(message.content);
        for (const embed of message.embeds || []) {
            parts.push(embed.title, embed.description);
            for (const field of embed.fields || []) parts.push(field.name, field.value);
        }
    }

    const text = normalizeText(parts.filter(Boolean).join(" "));
    const isStreamer = /\btop[\s_-]*streamer\b|\bstreamer\b/.test(text);
    const isVip = /\bvip\b|\bvery important person\b/.test(text);

    if (isStreamer && isVip) return "both";
    if (isStreamer) return "streamer";
    if (isVip) return "vip";
    return null;
}

function buildApplicationPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Top Streamer / VIP application")
        .setDescription("Use the button below to apply for Top Streamer or VIP. All six questions are required.");

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticketapp:start:both")
                .setLabel("Apply for Top Streamer / VIP")
                .setEmoji("📨")
                .setStyle(ButtonStyle.Primary)
        )]
    };
}

function createApplicationModal(page = "first") {
    const questions = page === "final" ? applicationQuestions.slice(5) : applicationQuestions.slice(0, 5);
    const modal = new ModalBuilder()
        .setCustomId(`ticketapp:submit:${page}`)
        .setTitle(page === "final" ? "Application: final question" : "Top Streamer / VIP application (1/2)");

    for (const question of questions) {
        const input = new TextInputBuilder()
            .setCustomId(question.id)
            .setStyle(question.style)
            .setMinLength(question.minLength || 1)
            .setMaxLength(1000)
            .setRequired(true);

        modal.addLabelComponents(new LabelBuilder()
            .setLabel(question.label)
            .setDescription(question.question)
            .setTextInputComponent(input));
    }

    return modal;
}

function buildContinueButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticketapp:continue")
            .setLabel("Continue application")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary)
    );
}

function buildApplicationEmbed(application) {
    const statusLabels = {
        in_progress: "Application incomplete",
        pending: "Pending review",
        claimed: "Claimed by staff",
        needs_info: "More information requested",
        approved: "Approved",
        rejected: "Declined",
        closed: "Ticket closed"
    };
    const questionLabels = Object.fromEntries(
        applicationQuestions.map(question => [question.id, question.question])
    );
    const color = application.status === "approved"
        ? 0x57f287
        : application.status === "rejected"
            ? 0xed4245
            : application.status === "closed"
                ? 0x747f8d
                : 0xfee75c;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("Top Streamer / VIP application")
        .setDescription(`Applicant: <@${application.applicantId}>`)
        .addFields(
            { name: "Status", value: statusLabels[application.status] || "Pending review", inline: true },
            { name: "Submitted", value: `<t:${Math.floor(new Date(application.submittedAt).getTime() / 1000)}:R>`, inline: true }
        );

    if (application.claimedBy) {
        embed.addFields({ name: "Claimed by", value: `<@${application.claimedBy}>`, inline: true });
    }

    for (const [id, answer] of Object.entries(application.answers || {})) {
        const label = questionLabels[id] || id;
        const value = String(answer || "").slice(0, 1024);
        embed.addFields({ name: label, value: value || "—" });
    }

    if (application.closedBy) {
        embed.setFooter({ text: `Closed by ${application.closedBy}` });
    }

    return embed;
}

function buildReviewButtons(application) {
    if (application.status === "closed") {
        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticketapp:reopen")
                .setLabel("Reopen ticket")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Success)
        )];
    }

    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticketapp:claim")
            .setLabel("Claim")
            .setEmoji("🙋")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticketapp:approve")
            .setLabel("Approve")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("ticketapp:reject")
            .setLabel("Decline")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("ticketapp:more-info")
            .setLabel("Request info")
            .setEmoji("📝")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ticketapp:close")
            .setLabel("Close")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Secondary)
    )];
}

function isTicketStaff(interaction) {
    const permissions = interaction.memberPermissions;
    if (permissions?.has(PermissionFlagsBits.Administrator)
        || permissions?.has(PermissionFlagsBits.ManageGuild)
        || permissions?.has(PermissionFlagsBits.ManageChannels)) {
        return true;
    }

    const roles = interaction.member?.roles?.cache;
    return Boolean(roles?.some(role => /\b(owner|admin|moderator|mod|support|staff|helper|ticket team)\b/i.test(role.name)));
}

function saveApplication(guildId, channelId, application) {
    return updateChannelState(guildId, channelId, { application });
}

function removeChannel(guildId, channelId) {
    const guild = loadState().guilds[guildId];
    if (!guild?.channels || !guild.channels[channelId]) return;
    delete guild.channels[channelId];
    saveState();
}

async function createTranscript(channel) {
    const messages = [];
    let before;

    for (let page = 0; page < 5; page += 1) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (!batch.size) break;
        messages.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }

    const lines = messages
        .sort((first, second) => first.createdTimestamp - second.createdTimestamp)
        .map(message => {
            const timestamp = new Date(message.createdTimestamp).toISOString();
            const content = message.content || "[no text]";
            const attachments = [...message.attachments.values()].map(attachment => attachment.url);
            const embeds = message.embeds
                .map(embed => [embed.title, embed.description].filter(Boolean).join(" — "))
                .filter(Boolean);
            return [
                `[${timestamp}] ${message.author.tag}: ${content}`,
                ...embeds.map(embed => `  Embed: ${embed}`),
                ...attachments.map(url => `  Attachment: ${url}`)
            ].join("\n");
        });

    const header = `Transcript for #${channel.name} (${channel.id})\nGenerated: ${new Date().toISOString()}\n\n`;
    return Buffer.from(`${header}${lines.join("\n\n") || "No messages found."}`, "utf8");
}

module.exports = {
    buildApplicationEmbed,
    buildApplicationPanel,
    buildContinueButton,
    buildReviewButtons,
    createApplicationModal,
    createTranscript,
    detectApplicationType,
    getChannelState,
    getApplicationQuestions: () => applicationQuestions,
    isTicketStaff,
    removeChannel,
    saveApplication,
    updateChannelState
};
