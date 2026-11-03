const { ChannelType, PermissionFlagsBits } = require("discord.js");

module.exports = {
    roles: [
        { name: "👑 Owner", color: "Gold" },
        { name: "🛠️ Admin", color: "Red" },
        { name: "🛡️ Moderator", color: "Blue" },
        { name: "🎥 Streamer", color: "Purple" },
        { name: "💎 Trusted Trader", color: "Aqua" },
        { name: "👤 Member", color: "Grey" }
    ],

    categories: [
        {
            name: "📢 INFORMATION",
            channels: [
                { name: "📜│rules", type: ChannelType.GuildText },
                { name: "📢│announcements", type: ChannelType.GuildText },
                { name: "👋│welcome", type: ChannelType.GuildText }
            ]
        },

        {
            name: "💬 COMMUNITY",
            channels: [
                { name: "💬│general", type: ChannelType.GuildText },
                { name: "😂│memes", type: ChannelType.GuildText },
                { name: "📸│media", type: ChannelType.GuildText }
            ]
        },

        {
            name: "🧠 STEAL A BRAINROT",
            channels: [
                { name: "💬│brainrot-chat", type: ChannelType.GuildText },

                {
                    name: "💰│buy",
                    type: ChannelType.GuildText,
                    permissions: [
                        {
                            target: "everyone",
                            deny: [PermissionFlagsBits.SendMessages]
                        }
                    ]
                },

                { name: "💸│sell", type: ChannelType.GuildText },
                { name: "🔄│trade", type: ChannelType.GuildText },
                { name: "📈│price-check", type: ChannelType.GuildText },
                { name: "🏆│showcase", type: ChannelType.GuildText },
                { name: "📷│proofs", type: ChannelType.GuildText }
            ]
        },

        {
            name: "🎙️ VOICE",
            channels: [
                {
                    name: "⏳│waiting-room",
                    type: ChannelType.GuildVoice
                },
                {
                    name: "🎵│music",
                    type: ChannelType.GuildVoice
                }
            ]
        },

        {
            name: "🎥 STREAMER",
            channels: [
                {
                    name: "🎙️│streamer-call",
                    type: ChannelType.GuildVoice,
                    streamerOnly: true
                }
            ]
        }
    ]
};