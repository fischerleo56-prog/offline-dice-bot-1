const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const shopTickets = require("../utils/shopTickets");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Shop-Verwaltung (Produkte & Zahlungsarten stellst du im Web-Dashboard ein).")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName("katalog")
            .setDescription("Postet/aktualisiert den Produktkatalog im Shop-Kanal."))
        .addSubcommand(sub => sub
            .setName("einstellen")
            .setDescription("Setzt Shop-Kanal und privaten Code-Kanal.")
            .addChannelOption(option => option
                .setName("shop_kanal")
                .setDescription("Kanal, in dem der Katalog angezeigt wird")
                .setRequired(false))
            .addChannelOption(option => option
                .setName("code_kanal")
                .setDescription("Privater Kanal, in den Codes gesendet werden")
                .setRequired(false))),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({ content: "Nur auf einem Server möglich.", ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        const shopStore = require("../utils/shopStore");

        if (sub === "einstellen") {
            const shop = interaction.options.getChannel("shop_kanal");
            const code = interaction.options.getChannel("code_kanal");
            const guild = shopStore.getGuild(interaction.guildId);
            shopStore.setSettings(interaction.guildId, {
                ...guild.settings,
                shopChannelId: shop?.id ?? guild.settings.shopChannelId,
                codeChannelId: code?.id ?? guild.settings.codeChannelId
            });
            return interaction.reply({
                content: `✅ Gespeichert.\nShop-Kanal: ${shop ? `<#${shop.id}>` : "unverändert"}\nCode-Kanal: ${code ? `<#${code.id}>` : "unverändert"}`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
            const result = await shopTickets.postCatalog(interaction.client, interaction.guildId);
            return interaction.editReply(`✅ Katalog mit ${result.products} Produkt(en) in <#${result.channelId}> gepostet.`);
        } catch (error) {
            return interaction.editReply(`❌ ${error.message}`);
        }
    }
};
