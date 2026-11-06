const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const { sendModerationDM } = require("../utils/moderationNotifications");

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
            const dmSent = await sendModerationDM(user, {
                title: `You have been unbanned from ${interaction.guild.name}`,
                description: "A moderator removed your ban. You may rejoin the server if you have a valid invite.",
                guildName: interaction.guild.name,
                moderator: interaction.user.tag,
                reason: "Your ban was removed.",
                color: 0x57f287
            });

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
                    },
                    {
                        name: "DM notice",
                        value: dmSent ? "Sent" : "Could not be delivered; the user may have DMs disabled or no mutual server."
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
