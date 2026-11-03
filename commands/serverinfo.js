const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Shows information about the server."),

    async execute(interaction) {

        const guild = interaction.guild;

        const embed = new EmbedBuilder()
            .setColor("#ff69b4")
            .setTitle("🌐 Server Information")
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                {
                    name: "📛 Server Name",
                    value: guild.name,
                    inline: true
                },
                {
                    name: "🆔 Server ID",
                    value: guild.id,
                    inline: true
                },
                {
                    name: "👑 Owner",
                    value: `<@${guild.ownerId}>`,
                    inline: true
                },
                {
                    name: "👥 Members",
                    value: `${guild.memberCount}`,
                    inline: true
                },
                {
                    name: "💬 Channels",
                    value: `${guild.channels.cache.size}`,
                    inline: true
                },
                {
                    name: "🎭 Roles",
                    value: `${guild.roles.cache.size}`,
                    inline: true
                },
                {
                    name: "📅 Created",
                    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};