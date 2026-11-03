const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member from the server.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member to ban")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the ban")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {

        const member = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (!member) {
            return interaction.reply({
                content: "❌ Member not found.",
                ephemeral: true
            });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: "❌ You can't ban yourself.",
                ephemeral: true
            });
        }

        if (member.id === interaction.guild.ownerId) {
            return interaction.reply({
                content: "❌ You can't ban the server owner.",
                ephemeral: true
            });
        }

        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You can't ban an administrator.",
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

        if (!member.bannable) {
            return interaction.reply({
                content: "❌ I can't ban this member. Check my role position.",
                ephemeral: true
            });
        }

        await member.ban({ reason });

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🔨 Member Banned")
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