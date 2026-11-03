const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user by their ID.")
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("The ID of the user to unban")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {

        const userId = interaction.options.getString("userid");

        try {

            const user = await interaction.client.users.fetch(userId);

            await interaction.guild.members.unban(userId);

            const embed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("🔓 User Unbanned")
                .addFields(
                    {
                        name: "👤 User",
                        value: `${user.tag}`,
                        inline: true
                    },
                    {
                        name: "🛡️ Moderator",
                        value: `${interaction.user.tag}`,
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });

        } catch {

            await interaction.reply({
                content: "❌ User not found or not banned.",
                ephemeral: true
            });

        }

    }
};