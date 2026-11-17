const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const shopTickets = require("../utils/shopTickets");
const shopStore = require("../utils/shopStore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Shop management (products and payment methods are set in the web dashboard).")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName("catalog")
            .setDescription("Posts / updates the product catalog in the shop channel."))
        .addSubcommand(sub => sub
            .setName("setup")
            .setDescription("Sets the shop channel and the private code channel.")
            .addChannelOption(option => option
                .setName("shop_channel")
                .setDescription("Channel where the catalog is shown")
                .setRequired(false))
            .addChannelOption(option => option
                .setName("code_channel")
                .setDescription("Private channel where submitted codes are sent")
                .setRequired(false))),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({ content: "This only works on a server.", ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();

        if (sub === "setup") {
            const shop = interaction.options.getChannel("shop_channel");
            const code = interaction.options.getChannel("code_channel");
            const guild = shopStore.getGuild(interaction.guildId);
            shopStore.setSettings(interaction.guildId, {
                ...guild.settings,
                shopChannelId: shop?.id ?? guild.settings.shopChannelId,
                codeChannelId: code?.id ?? guild.settings.codeChannelId
            });
            return interaction.reply({
                content: `✅ Saved.\nShop channel: ${shop ? `<#${shop.id}>` : "unchanged"}\nCode channel: ${code ? `<#${code.id}>` : "unchanged"}`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
            const result = await shopTickets.postCatalog(interaction.client, interaction.guildId);
            return interaction.editReply(`✅ Catalog with ${result.products} product(s) ${result.edited ? "updated" : "posted"} in <#${result.channelId}>.`);
        } catch (error) {
            return interaction.editReply(`❌ ${error.message}`);
        }
    }
};
