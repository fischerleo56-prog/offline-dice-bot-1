const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const { sendModerationDM } = require("../utils/moderationNotifications");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove the timeout from a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {

        const member = interaction.options.getMember("user");

        if (!member) {
            return interaction.reply({
                content: "❌ Member not found.",
                ephemeral: true
            });
        }

        if (!member.moderatable) {
            return interaction.reply({
                content: "❌ I can't remove the timeout from this member.",
                ephemeral: true
            });
        }

        await member.timeout(null);
        const dmSent = await sendModerationDM(member.user, {
            title: `Your timeout was removed in ${interaction.guild.name}`,
            description: "A moderator removed your timeout. You can send messages in the server again.",
            guildName: interaction.guild.name,
            moderator: interaction.user.tag,
            reason: "Your timeout was removed.",
            color: 0x57f287
        });

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Timeout Removed")
            .addFields(
                {
                    name: "👤 User",
                    value: member.user.tag,
                    inline: true
                },
                {
                    name: "🛡️ Moderator",
                    value: interaction.user.tag,
                    inline: true
                },
                {
                    name: "DM notice",
                    value: dmSent ? "Sent" : "Could not be delivered; the user may have DMs disabled."
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};
