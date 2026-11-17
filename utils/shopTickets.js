const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const shopStore = require("./shopStore");

const channelsSendingPanel = new Set();

// ---------- Helpers ----------

function embedColor(settings) {
    return parseInt(String(settings.color || "#5865f2").replace("#", ""), 16) || 0x5865f2;
}

function isShopChannel(channel, settings) {
    if (!channel?.guildId || channel.type !== ChannelType.GuildText) return false;
    const keyword = String(settings.ticketKeyword || "").toLowerCase();
    return Boolean(keyword) && channel.name.toLowerCase().includes(keyword);
}

function isStaff(interaction, settings) {
    const permissions = interaction.memberPermissions;
    if (permissions?.has(PermissionFlagsBits.Administrator) || permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
    const roles = interaction.member?.roles?.cache;
    return Boolean(roles && settings.staffRoleIds.some(id => roles.has(id)));
}

function staffMentions(settings) {
    return settings.staffRoleIds.map(id => `<@&${id}>`).join(" ");
}

function maskCode(code) {
    const clean = String(code).replace(/\s+/g, "");
    return clean.length <= 4 ? "****" : `${clean.slice(0, 4)}… (${clean.length} chars)`;
}

// The ticket owner, or staff (e.g. the shop owner testing), may use the order buttons.
function canUseOrder(interaction, order, settings) {
    return Boolean(order) && (order.userId === interaction.user.id || isStaff(interaction, settings));
}

// ---------- Panel inside the ticket ----------

function buildPanel(guildConfig, order) {
    const { settings, products, paymentMethods } = guildConfig;
    const availableProducts = products.filter(product => product.inStock);
    const methods = paymentMethods.filter(method => method.enabled);

    const embed = new EmbedBuilder()
        .setColor(embedColor(settings))
        .setTitle(settings.panelTitle)
        .setDescription(settings.panelDescription || "Choose your product and payment method.")
        .setTimestamp();

    const components = [];

    if (availableProducts.length) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("shop:product")
                .setPlaceholder("1️⃣ Select a product")
                .addOptions(availableProducts.slice(0, 25).map(product => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel([product.name, product.price].filter(Boolean).join(" – ").slice(0, 100))
                        .setValue(product.id)
                        .setDefault(order?.productId === product.id);
                    if (product.description) option.setDescription(product.description.replace(/\s+/g, " ").slice(0, 100));
                    if (product.emoji) option.setEmoji(product.emoji);
                    return option;
                }))
        ));
    } else if (products.length) {
        embed.addFields({ name: "Sold out", value: "All products are currently out of stock." });
    }

    if (methods.length) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("shop:pay")
                .setPlaceholder(`${availableProducts.length ? "2️⃣" : "1️⃣"} Select a payment method`)
                .addOptions(methods.slice(0, 25).map(method => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(method.label.slice(0, 100))
                        .setValue(method.id)
                        .setDefault(order?.methodId === method.id);
                    if (method.emoji) option.setEmoji(method.emoji);
                    return option;
                }))
        ));
    } else {
        embed.addFields({ name: "⚠️ No payment method", value: "No payment method is enabled yet. Please wait for the team." });
    }

    return { embeds: [embed], components };
}

function buildSummary(guildConfig, order) {
    const { settings, products, paymentMethods } = guildConfig;
    const product = products.find(item => item.id === order.productId);
    const method = paymentMethods.find(item => item.id === order.methodId);

    const embed = new EmbedBuilder()
        .setColor(embedColor(settings))
        .setTitle("✅ Your order")
        .addFields(
            { name: "Product", value: product ? product.name : "—", inline: true },
            { name: "Price", value: product?.price || "—", inline: true },
            { name: "Payment method", value: method ? `${method.emoji ? `${method.emoji} ` : ""}${method.label}` : "—", inline: true }
        )
        .setDescription(method?.instructions || "The team will contact you shortly.")
        .setFooter({ text: "When you have paid, click “I have paid”." })
        .setTimestamp();
    if (product?.imageUrl) embed.setThumbnail(product.imageUrl);

    const buttons = [
        new ButtonBuilder().setCustomId("shop:paid").setLabel("I have paid").setEmoji("✅").setStyle(ButtonStyle.Success)
    ];
    if (method?.askCode) {
        buttons.unshift(
            new ButtonBuilder().setCustomId("shop:code").setLabel("Send code").setEmoji("🔑").setStyle(ButtonStyle.Primary)
        );
    }
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

async function sendPanel(channel) {
    const guildConfig = shopStore.getGuild(channel.guildId);
    if (!isShopChannel(channel, guildConfig.settings)) return false;
    if (shopStore.getOrder(channel.guildId, channel.id)?.panelMessageId) return false;
    if (channelsSendingPanel.has(channel.id)) return false;

    channelsSendingPanel.add(channel.id);
    try {
        const order = {
            channelId: channel.id,
            userId: null,
            productId: null,
            methodId: null,
            status: "open",
            createdAt: new Date().toISOString()
        };
        const message = await channel.send(buildPanel(guildConfig, order));
        shopStore.saveOrder(channel.guildId, channel.id, { ...order, panelMessageId: message.id });
        return true;
    } finally {
        channelsSendingPanel.delete(channel.id);
    }
}

// Ticket King creates the channel first and sets permissions afterwards, so retry a few times.
async function sendPanelWithRetry(channel, attempts = 5) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await sendPanel(channel);
        } catch (error) {
            if (attempt === attempts) {
                console.error(`❌ Shop panel could not be sent in ${channel.id}:`, error.message);
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
    return false;
}

async function refreshSummary(channel, guildConfig, order) {
    const payload = buildSummary(guildConfig, order);
    if (order.summaryMessageId) {
        try {
            const existing = await channel.messages.fetch(order.summaryMessageId);
            await existing.edit(payload);
            return order;
        } catch (error) {
            // message deleted – send a new one
        }
    }
    const sent = await channel.send(payload);
    return { ...order, summaryMessageId: sent.id };
}

// ---------- Interactions ----------

async function handleSelect(interaction, kind) {
    const guildConfig = shopStore.getGuild(interaction.guildId);
    const { settings } = guildConfig;
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!order) {
        return interaction.reply({ content: "❌ This order is no longer active. Please open a new ticket.", ephemeral: true });
    }
    if (order.userId && order.userId !== interaction.user.id && !isStaff(interaction, settings)) {
        return interaction.reply({ content: "This is not your order.", ephemeral: true });
    }

    const next = { ...order, userId: order.userId || interaction.user.id };
    const value = interaction.values[0];
    let confirmation;

    if (kind === "product") {
        const product = guildConfig.products.find(item => item.id === value && item.inStock);
        if (!product) return interaction.reply({ content: "❌ This product is not available.", ephemeral: true });
        next.productId = product.id;
        confirmation = `Product selected: **${product.name}**`;
    } else {
        const method = guildConfig.paymentMethods.find(item => item.id === value && item.enabled);
        if (!method) return interaction.reply({ content: "❌ This payment method is not available.", ephemeral: true });
        next.methodId = method.id;
        confirmation = `Payment method selected: **${method.label}**`;
    }

    const needsProduct = guildConfig.products.some(item => item.inStock);
    const ready = next.methodId && (!needsProduct || next.productId);

    await interaction.deferUpdate();
    let saved = next;
    if (ready) {
        saved = await refreshSummary(interaction.channel, guildConfig, { ...next, status: "awaiting_payment" });
    }
    shopStore.saveOrder(interaction.guildId, interaction.channelId, saved);

    try {
        await interaction.message.edit(buildPanel(guildConfig, saved));
    } catch (error) {
        console.warn("Shop panel could not be updated:", error.message);
    }
    if (!ready) {
        await interaction.followUp({ content: `✅ ${confirmation}. Please select the other option too.`, ephemeral: true });
    }
}

function saleButtons(ticketChannelId, confirmLabel = "Confirm sale") {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`shop:sale:${ticketChannelId}`).setLabel(confirmLabel).setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`shop:reject:${ticketChannelId}`).setLabel("Reject").setEmoji("❌").setStyle(ButtonStyle.Danger)
    );
}

async function handlePaid(interaction) {
    const guildConfig = shopStore.getGuild(interaction.guildId);
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!canUseOrder(interaction, order, guildConfig.settings)) {
        return interaction.reply({ content: "Only the buyer can do this.", ephemeral: true });
    }
    const buyerId = order.userId || interaction.user.id;
    shopStore.saveOrder(interaction.guildId, interaction.channelId, { ...order, userId: buyerId, status: "paid_claimed" });
    await interaction.reply({
        content: `💸 <@${buyerId}> says they have paid. ${staffMentions(guildConfig.settings)} please check and confirm the sale.`.trim(),
        components: [saleButtons(interaction.channelId)],
        allowedMentions: { users: [buyerId], roles: guildConfig.settings.staffRoleIds }
    });
}

async function handleCodeButton(interaction) {
    const settings = shopStore.getGuild(interaction.guildId).settings;
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!canUseOrder(interaction, order, settings)) {
        return interaction.reply({ content: "Only the buyer can send a code.", ephemeral: true });
    }
    const modal = new ModalBuilder()
        .setCustomId("shop:codemodal")
        .setTitle("Send code")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("code")
                    .setLabel("Your code")
                    .setPlaceholder("Paste your code here")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(4)
                    .setMaxLength(100)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("note")
                    .setLabel("Note / amount (optional)")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
            )
        );
    return interaction.showModal(modal);
}

async function handleCodeModal(interaction) {
    const guildConfig = shopStore.getGuild(interaction.guildId);
    const { settings, products, paymentMethods } = guildConfig;
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!canUseOrder(interaction, order, settings)) {
        return interaction.reply({ content: "❌ No active order found.", ephemeral: true });
    }

    const buyerId = order.userId || interaction.user.id;
    const code = interaction.fields.getTextInputValue("code").trim();
    const note = interaction.fields.getTextInputValue("note")?.trim();
    const product = products.find(item => item.id === order.productId);
    const method = paymentMethods.find(item => item.id === order.methodId);

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("🔑 New code")
        .addFields(
            { name: "Customer", value: `<@${buyerId}>`, inline: true },
            { name: "Ticket", value: `<#${interaction.channelId}>`, inline: true },
            { name: "Payment method", value: method?.label || "—", inline: true },
            { name: "Product", value: product ? `${product.name}${product.price ? ` – ${product.price}` : ""}` : "—" },
            { name: "Code", value: `\`\`\`${code.replace(/`/g, "'")}\`\`\`` }
        )
        .setTimestamp();
    if (note) embed.addFields({ name: "Note", value: note.slice(0, 200) });

    const payload = {
        content: staffMentions(settings) || undefined,
        embeds: [embed],
        components: [saleButtons(interaction.channelId, "Valid – confirm sale")],
        allowedMentions: { roles: settings.staffRoleIds }
    };

    let delivered = "private";
    try {
        const codeChannel = settings.codeChannelId
            ? await interaction.guild.channels.fetch(settings.codeChannelId)
            : null;
        if (!codeChannel?.isTextBased()) throw new Error("No code channel set");
        await codeChannel.send(payload);
    } catch (error) {
        console.warn("Code channel unreachable, sending into the ticket:", error.message);
        delivered = "ticket";
        await interaction.channel.send(payload);
    }

    shopStore.saveOrder(interaction.guildId, interaction.channelId, {
        ...order,
        userId: buyerId,
        status: "code_sent",
        codeMasked: maskCode(code)
    });

    await interaction.channel.send({
        content: `🔑 <@${buyerId}> sent a code. The team is checking it now.`,
        allowedMentions: { users: [buyerId] }
    });
    await interaction.editReply(
        delivered === "private"
            ? "✅ Your code was sent securely to the team."
            : "✅ Your code was sent to the team (in this ticket, because no private code channel is set yet)."
    );
}

// Seller clicks "Confirm sale" -> asks how many items were sold
async function handleSaleButton(interaction) {
    const ticketChannelId = interaction.customId.split(":")[2];
    const settings = shopStore.getGuild(interaction.guildId).settings;
    if (!isStaff(interaction, settings)) {
        return interaction.reply({ content: "Only the team can confirm sales.", ephemeral: true });
    }
    const order = shopStore.getOrder(interaction.guildId, ticketChannelId);
    if (!order) return interaction.reply({ content: "❌ Order not found.", ephemeral: true });
    if (order.status === "confirmed") {
        return interaction.reply({ content: "This sale was already confirmed.", ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`shop:salemodal:${ticketChannelId}`)
        .setTitle("Confirm sale")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("quantity")
                    .setLabel("How many were sold? (removed from stock)")
                    .setStyle(TextInputStyle.Short)
                    .setValue("1")
                    .setMinLength(1)
                    .setMaxLength(6)
                    .setRequired(true)
            )
        );
    return interaction.showModal(modal);
}

async function handleSaleModal(interaction) {
    const ticketChannelId = interaction.customId.split(":")[2];
    const guildConfig = shopStore.getGuild(interaction.guildId);
    if (!isStaff(interaction, guildConfig.settings)) {
        return interaction.reply({ content: "Only the team can confirm sales.", ephemeral: true });
    }
    const quantity = Number.parseInt(interaction.fields.getTextInputValue("quantity").trim(), 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
        return interaction.reply({ content: "❌ Please enter a whole number of 1 or more.", ephemeral: true });
    }
    const order = shopStore.getOrder(interaction.guildId, ticketChannelId);
    if (!order) return interaction.reply({ content: "❌ Order not found.", ephemeral: true });
    if (order.status === "confirmed") {
        return interaction.reply({ content: "This sale was already confirmed.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let stockText = "no product selected";
    let productName = null;
    if (order.productId) {
        const result = shopStore.adjustStock(interaction.guildId, order.productId, -quantity);
        if (result) {
            productName = result.product.name;
            stockText = result.stock === null
                ? "stock is not tracked (unlimited)"
                : `stock of **${result.product.name}** is now **${result.stock}**`;
        }
    }
    shopStore.saveOrder(interaction.guildId, ticketChannelId, {
        ...order,
        status: "confirmed",
        quantity,
        confirmedBy: interaction.user.id
    });

    // disable the buttons on the message the seller clicked
    if (interaction.message) {
        const base = interaction.message.embeds[0]
            ? EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x57f287).setFooter({ text: `Sale confirmed by ${interaction.user.tag} (x${quantity})` })
            : null;
        await interaction.message.edit({
            ...(base ? { embeds: [base] } : { content: `✅ Sale confirmed by ${interaction.user.tag} (x${quantity})` }),
            components: []
        }).catch(() => {});
    }

    try {
        const ticket = await interaction.guild.channels.fetch(ticketChannelId);
        await ticket.send({
            content: `✅ ${order.userId ? `<@${order.userId}> ` : ""}Your payment was confirmed${productName ? ` for **${productName}**` : ""}. Thank you!`,
            allowedMentions: { users: order.userId ? [order.userId] : [] }
        });
    } catch (error) {
        // ticket already deleted
    }

    // keep the shop catalog in sync
    if (guildConfig.settings.shopChannelId) {
        postCatalog(interaction.client, interaction.guildId).catch(error =>
            console.warn("Catalog could not be updated:", error.message));
    }

    await interaction.editReply(`✅ Sale confirmed (x${quantity}); ${stockText}.`);
}

async function handleReject(interaction) {
    const ticketChannelId = interaction.customId.split(":")[2];
    const settings = shopStore.getGuild(interaction.guildId).settings;
    if (!isStaff(interaction, settings)) {
        return interaction.reply({ content: "Only the team can do this.", ephemeral: true });
    }
    const order = shopStore.getOrder(interaction.guildId, ticketChannelId);
    if (order && order.status !== "confirmed") {
        shopStore.saveOrder(interaction.guildId, ticketChannelId, { ...order, status: "rejected" });
    }

    const footer = { text: `Rejected by ${interaction.user.tag}` };
    if (interaction.message.embeds[0]) {
        await interaction.update({
            embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xed4245).setFooter(footer)],
            components: []
        });
    } else {
        await interaction.update({ content: `❌ Rejected by ${interaction.user.tag}`, components: [] });
    }

    try {
        const ticket = await interaction.guild.channels.fetch(ticketChannelId);
        await ticket.send({
            content: `❌ ${order?.userId ? `<@${order.userId}> ` : ""}We could not confirm your payment or code. Please send a new code or choose another payment method.`,
            allowedMentions: { users: order?.userId ? [order.userId] : [] }
        });
    } catch (error) {
        await interaction.followUp({ content: "⚠️ The ticket could not be notified (maybe already deleted).", ephemeral: true });
    }
}

async function handleInteraction(interaction) {
    if (!interaction.guildId) {
        return interaction.reply({ content: "This only works on a server.", ephemeral: true });
    }
    const id = interaction.customId;

    if (interaction.isStringSelectMenu()) {
        if (id === "shop:product") return handleSelect(interaction, "product");
        if (id === "shop:pay") return handleSelect(interaction, "pay");
    }
    if (interaction.isButton()) {
        if (id === "shop:paid") return handlePaid(interaction);
        if (id === "shop:code") return handleCodeButton(interaction);
        if (id.startsWith("shop:sale:")) return handleSaleButton(interaction);
        if (id.startsWith("shop:reject:")) return handleReject(interaction);
    }
    if (interaction.isModalSubmit()) {
        if (id === "shop:codemodal") return handleCodeModal(interaction);
        if (id.startsWith("shop:salemodal:")) return handleSaleModal(interaction);
    }
}

// ---------- Catalog in the shop channel ----------

function buildCatalogMessages(guildConfig) {
    const { settings, products } = guildConfig;
    const color = embedColor(settings);
    const header = new EmbedBuilder()
        .setColor(color)
        .setTitle(settings.shopTitle)
        .setDescription([settings.shopDescription, settings.buyInfo].filter(Boolean).join("\n\n") || null);

    const productEmbeds = products.map(product => {
        const embed = new EmbedBuilder()
            .setColor(product.inStock ? color : 0x747f8d)
            .setTitle(`${product.emoji ? `${product.emoji} ` : ""}${product.name}${product.inStock ? "" : " (sold out)"}`)
            .setDescription(product.description || null);
        if (product.price) embed.addFields({ name: "Price", value: product.price, inline: true });
        if (typeof product.stock === "number") embed.addFields({ name: "In stock", value: String(product.stock), inline: true });
        if (product.imageUrl) embed.setImage(product.imageUrl);
        return embed;
    });

    const embeds = [header, ...productEmbeds];
    const chunks = [];
    for (let index = 0; index < embeds.length; index += 10) chunks.push(embeds.slice(index, index + 10));
    return chunks;
}

async function postCatalog(client, guildId) {
    const guild = await client.guilds.fetch(guildId);
    const guildConfig = shopStore.getGuild(guildId);
    const { settings, products } = guildConfig;
    if (!settings.shopChannelId) throw new Error("No shop channel is set.");

    const channel = await guild.channels.fetch(settings.shopChannelId);
    if (!channel?.isTextBased()) throw new Error("The shop channel is not a text channel.");

    const chunks = buildCatalogMessages(guildConfig);
    const previous = guildConfig.shopMessages;

    // Try to edit the existing catalog messages in place (no spam when stock changes)
    if (previous?.channelId === channel.id && previous.messageIds.length === chunks.length) {
        try {
            for (const [index, messageId] of previous.messageIds.entries()) {
                const message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: chunks[index] });
            }
            return { channelId: channel.id, products: products.length, edited: true };
        } catch (error) {
            // fall through and repost
        }
    }

    if (previous?.channelId) {
        try {
            const oldChannel = await guild.channels.fetch(previous.channelId);
            for (const messageId of previous.messageIds) {
                await oldChannel.messages.delete(messageId).catch(() => {});
            }
        } catch (error) {
            // channel gone – ignore
        }
    }

    const messageIds = [];
    for (const chunk of chunks) {
        const message = await channel.send({ embeds: chunk });
        messageIds.push(message.id);
    }
    shopStore.setShopMessages(guildId, channel.id, messageIds);
    return { channelId: channel.id, products: products.length, edited: false };
}

module.exports = {
    handleInteraction,
    isShopChannel,
    sendPanel,
    sendPanelWithRetry,
    postCatalog
};
