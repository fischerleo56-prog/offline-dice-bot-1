const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require("discord.js");

const serverTickets = require("../utils/serverTickets");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Postet das Support- und Meldepanel in diesen Channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: "❌ Das Ticket-Panel kann nur in einem normalen Text-Channel gepostet werden.",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        const panelMessage = await interaction.channel.send(serverTickets.buildPanel());
        return interaction.editReply(`✅ Das Ticket-Panel wurde in <#${panelMessage.channelId}> gepostet.`);
    }
};
