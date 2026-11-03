const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require("discord.js");

const serverTickets = require("../utils/serverTickets");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Post the support and report panel in this channel.")
        .addRoleOption(option => option
            .setName("staff_role_1")
            .setDescription("A role that can access tickets created from this panel.")
            .setRequired(true))
        .addRoleOption(option => option
            .setName("staff_role_2")
            .setDescription("Another role that can access tickets from this panel.")
            .setRequired(false))
        .addRoleOption(option => option
            .setName("staff_role_3")
            .setDescription("Another role that can access tickets from this panel.")
            .setRequired(false))
        .addRoleOption(option => option
            .setName("staff_role_4")
            .setDescription("Another role that can access tickets from this panel.")
            .setRequired(false))
        .addRoleOption(option => option
            .setName("staff_role_5")
            .setDescription("Another role that can access tickets from this panel.")
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: "❌ The ticket panel can only be posted in a standard text channel.",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        const staffRoles = [1, 2, 3, 4, 5]
            .map(number => interaction.options.getRole(`staff_role_${number}`))
            .filter(Boolean);
        const uniqueRoles = [...new Map(staffRoles.map(role => [role.id, role])).values()];
        if (uniqueRoles.some(role => role.id === interaction.guild.roles.everyone.id)) {
            return interaction.editReply("❌ The @everyone role cannot be given access to private tickets.");
        }

        const panelMessage = await interaction.channel.send(
            serverTickets.buildPanel(uniqueRoles.map(role => role.id))
        );
        return interaction.editReply(`✅ The ticket panel was posted in <#${panelMessage.channelId}>.`);
    }
};
