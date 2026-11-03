const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

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
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};