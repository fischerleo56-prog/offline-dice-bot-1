const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ticketWelcome = require("../utils/ticketWelcome");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("welcomemessage")
        .setDescription("Sets the message for new Ticket King tickets.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Text that is sent after the first message in the ticket.")
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: "This command only works on a server.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: "You need the Manage Server permission for this.",
                ephemeral: true
            });
        }

        const message = interaction.options.getString("message", true);

        if (!message.trim()) {
            return interaction.reply({
                content: "Please enter a message for the bot to send.",
                ephemeral: true
            });
        }

        ticketWelcome.setWelcomeMessage(interaction.guildId, message);

        return interaction.reply({
            content: "✅ The welcome message for new Ticket King tickets was saved. Use `{user}` to mention the person.",
            ephemeral: true
        });
    }
};
