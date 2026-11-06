const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const { sendModerationDM } = require("../utils/moderationNotifications");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member from the server.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member to kick")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the kick")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {

        const member = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (!member) {
            return interaction.reply({
                content: "❌ Member not found.",
                ephemeral: true
            });
        }

        // Sich selbst kicken
        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: "❌ You can't kick yourself.",
                ephemeral: true
            });
        }

        // Serverbesitzer schützen
        if (member.id === interaction.guild.ownerId) {
            return interaction.reply({
                content: "❌ You can't kick the server owner.",
                ephemeral: true
            });
        }

        // Administrator schützen
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You can't kick an administrator.",
                ephemeral: true
            });
        }

        // Rollenhierarchie prüfen
        if (
            member.roles.highest.position >=
            interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "❌ This member has the same or a higher role than you.",
                ephemeral: true
            });
        }

        // Kann der Bot den User kicken?
        if (!member.kickable) {
            return interaction.reply({
                content: "❌ I can't kick this member. Check my role position.",
                ephemeral: true
            });
        }

        const dmSent = await sendModerationDM(member.user, {
            title: `You are being kicked from ${interaction.guild.name}`,
            description: "A moderator is removing you from this server.",
            guildName: interaction.guild.name,
            moderator: interaction.user.tag,
            reason,
            color: 0xfee75c
        });

        try {
            await member.kick(reason);
        } catch (error) {
            if (dmSent) {
                await sendModerationDM(member.user, {
                    title: `The kick from ${interaction.guild.name} was not completed`,
                    description: "The moderation action could not be completed, so your account remains in the server.",
                    guildName: interaction.guild.name,
                    moderator: interaction.user.tag,
                    reason: "The kick action failed.",
                    color: 0xfee75c
                });
            }
            throw error;
        }

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("👢 Member Kicked")
            .addFields(
                {
                    name: "👤 User",
                    value: `${member.user.tag}`,
                    inline: true
                },
                {
                    name: "🛡️ Moderator",
                    value: `${interaction.user.tag}`,
                    inline: true
                },
                {
                    name: "📝 Reason",
                    value: reason
                },
                {
                    name: "DM notice",
                    value: dmSent ? "Sent before the kick" : "Could not be delivered; the user may have DMs disabled."
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};
