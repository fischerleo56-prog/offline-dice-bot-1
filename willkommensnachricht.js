const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ticketWelcome = require("../utils/ticketWelcome");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("willkommensnachricht")
        .setDescription("Legt die Nachricht für neue Ticket-King-Tickets fest.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option
                .setName("nachricht")
                .setDescription("Text, der nach der ersten Nachricht im Ticket gesendet wird.")
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: "Dieser Befehl funktioniert nur auf einem Server.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: "Dafür brauchst du die Berechtigung „Server verwalten“.",
                ephemeral: true
            });
        }

        const message = interaction.options.getString("nachricht", true);

        if (!message.trim()) {
            return interaction.reply({
                content: "Bitte gib eine Nachricht ein, die der Bot senden soll.",
                ephemeral: true
            });
        }

        ticketWelcome.setWelcomeMessage(interaction.guildId, message);

        return interaction.reply({
            content: "✅ Die Willkommensnachricht für neue Ticket-King-Tickets wurde gespeichert. Mit `{user}` kannst du die Person erwähnen.",
            ephemeral: true
        });
    }
};
