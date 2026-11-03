const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const createRole = require("../utils/createRole");
const createCategory = require("../utils/createCategory");
const createChannel = require("../utils/createChannel");
const createVoice = require("../utils/createVoice");
const {
    streamerOnly,
    everyoneReadOnly
} = require("../utils/createPermissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const guild = interaction.guild;

        await interaction.reply({
            content: "🚀 Starting server setup...",
            ephemeral: true
        });

        // =========================
        // ROLES
        // =========================

        await createRole(guild, "👑 Owner", "Gold");
        await createRole(guild, "🛠️ Admin", "Red");
        await createRole(guild, "🛡️ Moderator", "Blue");
        await createRole(guild, "🎥 Streamer", "Purple");
        await createRole(guild, "💎 Trusted Trader", "Aqua");
        await createRole(guild, "👤 Member", "Grey");

        // =========================
        // CATEGORIES
        // =========================

        const information = await createCategory(guild, "📢 INFORMATION");
        const community = await createCategory(guild, "💬 COMMUNITY");
        const brainrot = await createCategory(guild, "🧠 STEAL A BRAINROT");
        const voice = await createCategory(guild, "🎙️ VOICE");
        const streamer = await createCategory(guild, "🎥 STREAMER");

               // =========================
        // INFORMATION
        // =========================

        await createChannel(guild, {
            name: "📜│rules",
            parent: information.id,
            permissionOverwrites: everyoneReadOnly(guild)
        });

        await createChannel(guild, {
            name: "📢│announcements",
            parent: information.id,
            permissionOverwrites: everyoneReadOnly(guild)
        });

        await createChannel(guild, {
            name: "👋│welcome",
            parent: information.id,
            permissionOverwrites: everyoneReadOnly(guild)
        });

        // =========================
        // COMMUNITY
        // =========================

        await createChannel(guild, {
            name: "💬│general",
            parent: community.id
        });

        await createChannel(guild, {
            name: "😂│memes",
            parent: community.id
        });

        await createChannel(guild, {
            name: "📸│media",
            parent: community.id
        });

        // =========================
        // STEAL A BRAINROT
        // =========================

        await createChannel(guild, {
            name: "💬│brainrot-chat",
            parent: brainrot.id
        });

       await createChannel(guild, {
    name: "💰│buy",
    parent: brainrot.id,
    permissionOverwrites: [
        {
            id: guild.roles.everyone.id,
            deny: [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.SendMessagesInThreads
            ]
        }
    ]
});

        await createChannel(guild, {
            name: "💸│sell",
            parent: brainrot.id
        });

        await createChannel(guild, {
            name: "🔄│trade",
            parent: brainrot.id
        });

        await createChannel(guild, {
            name: "📈│price-check",
            parent: brainrot.id
        });

        await createChannel(guild, {
            name: "🏆│showcase",
            parent: brainrot.id
        });

        await createChannel(guild, {
            name: "📷│proofs",
            parent: brainrot.id
        });
                // =========================
        // VOICE
        // =========================

        await createVoice(guild, {
            name: "⏳│waiting-room",
            parent: voice.id
        });

        await createVoice(guild, {
            name: "🎵│music",
            parent: voice.id
        });

        // =========================
        // STREAMER
        // =========================

        const streamerRole = guild.roles.cache.find(
            r => r.name === "🎥 Streamer"
        );

        await createVoice(guild, {
            name: "🎙️│streamer-call",
            parent: streamer.id,
            permissionOverwrites: streamerOnly(guild, streamerRole)
        });

        await interaction.followUp({
            content: "✅ Roles, categories and channels created successfully!",
            ephemeral: true
        });

    }
};