const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder
} = require("discord.js");

const ticketApplications = require("../utils/ticketApplications");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bewerbung")
        .setDescription("Verwaltet Top-Streamer- und VIP-Bewerbungen im aktuellen Ticket.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand => subcommand
            .setName("panel")
            .setDescription("Postet das gemeinsame Top-Streamer-/VIP-Bewerbungsformular.")
        )
        .addSubcommand(subcommand => subcommand
            .setName("status")
            .setDescription("Zeigt den Status der Bewerbung in diesem Ticket.")
        )
        .addSubcommand(subcommand => subcommand
            .setName("transkript")
            .setDescription("Exportiert die letzten Nachrichten dieses Tickets als Textdatei.")
        ),

    async execute(interaction) {
        if (!interaction.guildId || !interaction.channel?.isTextBased() || !interaction.channel.messages) {
            return interaction.reply({
                content: "Dieser Befehl funktioniert nur in einem Server-Textkanal oder Ticket.",
                ephemeral: true
            });
        }

        const action = interaction.options.getSubcommand();
        const channelState = ticketApplications.getChannelState(interaction.guildId, interaction.channelId);

        if (action === "panel") {
            if (channelState?.applicationPanelSent) {
                return interaction.reply({
                    content: "In diesem Kanal wurde bereits ein Bewerbungsfeld eingerichtet.",
                    ephemeral: true
                });
            }
            if (channelState?.application) {
                return interaction.reply({
                    content: "In diesem Kanal liegt bereits eine Bewerbung vor.",
                    ephemeral: true
                });
            }

            const panel = await interaction.channel.send(ticketApplications.buildApplicationPanel());
            ticketApplications.updateChannelState(interaction.guildId, interaction.channelId, {
                applicationPanelSent: true,
                applicationKind: "both",
                applicationPanelMessageId: panel.id
            });
            return interaction.reply({
                content: "✅ Das Bewerbungsfeld wurde in diesem Kanal gepostet.",
                ephemeral: true
            });
        }

        if (action === "status") {
            if (!channelState?.application) {
                return interaction.reply({
                    content: channelState?.applicationPanelSent
                        ? "Das Formular ist bereit, aber noch wurde keine Bewerbung eingereicht."
                        : "In diesem Kanal wurde noch kein Bewerbungsfeld eingerichtet.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [ticketApplications.buildApplicationEmbed(channelState.application)],
                ephemeral: true
            });
        }

        if (action === "transkript") {
            await interaction.deferReply({ ephemeral: true });
            const transcript = await ticketApplications.createTranscript(interaction.channel);
            return interaction.editReply({
                content: "✅ Transkript erstellt.",
                files: [new AttachmentBuilder(transcript, {
                    name: `${interaction.channel.name}-transcript.txt`
                })]
            });
        }
    }
};
