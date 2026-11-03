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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: "❌ The ticket panel can only be posted in a standard text channel.",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        const panelMessage = await interaction.channel.send(serverTickets.buildPanel());
        return interaction.editReply(`✅ The ticket panel was posted in <#${panelMessage.channelId}>.`);
    }
};
