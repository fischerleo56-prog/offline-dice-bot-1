const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder
} = require("discord.js");

const ticketApplications = require("../utils/ticketApplications");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("application")
        .setDescription("Verwaltet Top-Streamer- und VIP-Bewerbungen im aktuellen Ticket.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand => subcommand
            .setName("panel")
            .setDescription("Posts the shared Top Streamer / VIP application form.")
        )
        .addSubcommand(subcommand => subcommand
            .setName("status")
            .setDescription("Shows the status of the application in this ticket.")
        )
        .addSubcommand(subcommand => subcommand
            .setName("transcript")
            .setDescription("Exports the latest messages of this ticket as a text file.")
        ),

    async execute(interaction) {
        if (!interaction.guildId || !interaction.channel?.isTextBased() || !interaction.channel.messages) {
            return interaction.reply({
                content: "This command only works in a server text channel or ticket.",
                ephemeral: true
            });
        }

        const action = interaction.options.getSubcommand();
        const channelState = ticketApplications.getChannelState(interaction.guildId, interaction.channelId);

        if (action === "panel") {
            if (channelState?.applicationPanelSent) {
                return interaction.reply({
                    content: "An application form has already been set up in this channel.",
                    ephemeral: true
                });
            }
            if (channelState?.application) {
                return interaction.reply({
                    content: "There is already an application in this channel.",
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
                content: "✅ The application form was posted in this channel.",
                ephemeral: true
            });
        }

        if (action === "status") {
            if (!channelState?.application) {
                return interaction.reply({
                    content: channelState?.applicationPanelSent
                        ? "The form is ready, but no application has been submitted yet."
                        : "No application form has been set up in this channel yet.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [ticketApplications.buildApplicationEmbed(channelState.application)],
                ephemeral: true
            });
        }

        if (action === "transcript") {
            await interaction.deferReply({ ephemeral: true });
            const transcript = await ticketApplications.createTranscript(interaction.channel);
            return interaction.editReply({
                content: "✅ Transcript created.",
                files: [new AttachmentBuilder(transcript, {
                    name: `${interaction.channel.name}-transcript.txt`
                })]
            });
        }
    }
};
