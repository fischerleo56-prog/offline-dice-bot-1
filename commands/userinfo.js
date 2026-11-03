const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Shows information about a user.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user")
                .setRequired(false)
        ),

    async execute(interaction) {

        const member =
            interaction.options.getMember("user") ||
            interaction.member;

        const embed = new EmbedBuilder()
            .setColor("#ff69b4")
            .setTitle("👤 User Information")
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: "👤 Username",
                    value: member.user.tag,
                    inline: true
                },
                {
                    name: "🆔 User ID",
                    value: member.id,
                    inline: true
                },
                {
                    name: "🤖 Bot",
                    value: member.user.bot ? "Yes" : "No",
                    inline: true
                },
                {
                    name: "📅 Account Created",
                    value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`
                },
                {
                    name: "📥 Joined Server",
                    value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
                },
                {
                    name: "🎭 Highest Role",
                    value: `${member.roles.highest}`
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};