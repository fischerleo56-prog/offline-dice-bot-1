const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member to timeout")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Timeout duration in minutes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320) // 28 Tage
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {

        const member = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (!member) {
            return interaction.reply({
                content: "❌ Member not found.",
                ephemeral: true
            });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: "❌ You can't timeout yourself.",
                ephemeral: true
            });
        }

        if (member.id === interaction.guild.ownerId) {
            return interaction.reply({
                content: "❌ You can't timeout the server owner.",
                ephemeral: true
            });
        }

        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You can't timeout an administrator.",
                ephemeral: true
            });
        }

        if (
            member.roles.highest.position >=
            interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "❌ This member has the same or a higher role than you.",
                ephemeral: true
            });
        }

        if (!member.moderatable) {
            return interaction.reply({
                content: "❌ I can't timeout this member.",
                ephemeral: true
            });
        }

        await member.timeout(minutes * 60 * 1000, reason);

        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("⏳ Member Timed Out")
            .addFields(
                {
                    name: "👤 User",
                    value: member.user.tag,
                    inline: true
                },
                {
                    name: "⏱️ Duration",
                    value: `${minutes} minute(s)`,
                    inline: true
                },
                {
                    name: "🛡️ Moderator",
                    value: interaction.user.tag,
                    inline: true
                },
                {
                    name: "📝 Reason",
                    value: reason
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};