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

// ---------- Hilfsfunktionen ----------

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

function getEmoji(value) {
    return value || undefined;
}

function maskCode(code) {
    const clean = String(code).replace(/\s+/g, "");
    return clean.length <= 4 ? "****" : `${clean.slice(0, 4)}…(${clean.length} Zeichen)`;
}

// ---------- Panel im Ticket ----------

function buildPanel(guildConfig, order) {
    const { settings, products, paymentMethods } = guildConfig;
    const availableProducts = products.filter(product => product.inStock);
    const methods = paymentMethods.filter(method => method.enabled);

    const embed = new EmbedBuilder()
        .setColor(embedColor(settings))
        .setTitle(settings.panelTitle)
        .setDescription(settings.panelDescription || "Wähle Produkt und Zahlungsart aus.")
        .setTimestamp();

    const components = [];

    if (availableProducts.length) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("shop:product")
                .setPlaceholder("1️⃣ Produkt auswählen")
                .addOptions(availableProducts.slice(0, 25).map(product => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel([product.name, product.price].filter(Boolean).join(" – ").slice(0, 100))
                        .setValue(product.id)
                        .setDefault(order?.productId === product.id);
                    if (product.description) option.setDescription(product.description.replace(/\s+/g, " ").slice(0, 100));
                    if (getEmoji(product.emoji)) option.setEmoji(product.emoji);
                    return option;
                }))
        ));
    }

    if (methods.length) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("shop:pay")
                .setPlaceholder(`${availableProducts.length ? "2️⃣" : "1️⃣"} Zahlungsart auswählen`)
                .addOptions(methods.slice(0, 25).map(method => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(method.label.slice(0, 100))
                        .setValue(method.id)
                        .setDefault(order?.methodId === method.id);
                    if (getEmoji(method.emoji)) option.setEmoji(method.emoji);
                    return option;
                }))
        ));
    } else {
        embed.addFields({ name: "⚠️ Keine Zahlungsart", value: "Es ist noch keine Zahlungsart aktiviert. Bitte warte auf das Team." });
    }

    return { embeds: [embed], components };
}

function buildSummary(guildConfig, order) {
    const { settings, products, paymentMethods } = guildConfig;
    const product = products.find(item => item.id === order.productId);
    const method = paymentMethods.find(item => item.id === order.methodId);

    const embed = new EmbedBuilder()
        .setColor(embedColor(settings))
        .setTitle("✅ Deine Bestellung")
        .addFields(
            { name: "Produkt", value: product ? product.name : "—", inline: true },
            { name: "Preis", value: product?.price || "—", inline: true },
            { name: "Zahlungsart", value: method ? `${method.emoji ? `${method.emoji} ` : ""}${method.label}` : "—", inline: true }
        )
        .setDescription(method?.instructions || "Das Team meldet sich gleich bei dir.")
        .setFooter({ text: "Wenn du bezahlt hast, klicke auf „Ich habe bezahlt“." })
        .setTimestamp();
    if (product?.imageUrl) embed.setThumbnail(product.imageUrl);

    const buttons = [
        new ButtonBuilder().setCustomId("shop:paid").setLabel("Ich habe bezahlt").setEmoji("✅").setStyle(ButtonStyle.Success)
    ];
    if (method?.askCode) {
        buttons.unshift(
            new ButtonBuilder().setCustomId("shop:code").setLabel("Code senden").setEmoji("🔑").setStyle(ButtonStyle.Primary)
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

// Ticket King legt den Kanal an und setzt danach die Rechte – deshalb ein paar Versuche.
async function sendPanelWithRetry(channel, attempts = 5) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await sendPanel(channel);
        } catch (error) {
            if (attempt === attempts) {
                console.error(`❌ Shop-Panel in ${channel.id} konnte nicht gesendet werden:`, error.message);
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
            // Nachricht gelöscht – neue senden
        }
    }
    const sent = await channel.send(payload);
    return { ...order, summaryMessageId: sent.id };
}

// ---------- Interaktionen ----------

async function handleSelect(interaction, kind) {
    const guildConfig = shopStore.getGuild(interaction.guildId);
    const { settings } = guildConfig;
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!order) {
        return interaction.reply({ content: "❌ Diese Bestellung ist nicht mehr aktiv. Bitte öffne ein neues Ticket.", ephemeral: true });
    }

    const staff = isStaff(interaction, settings);
    if (order.userId && order.userId !== interaction.user.id && !staff) {
        return interaction.reply({ content: "Das ist nicht deine Bestellung.", ephemeral: true });
    }

    const next = { ...order, userId: order.userId || (staff ? null : interaction.user.id) };
    const value = interaction.values[0];
    let confirmation;

    if (kind === "product") {
        const product = guildConfig.products.find(item => item.id === value && item.inStock);
        if (!product) return interaction.reply({ content: "❌ Dieses Produkt ist nicht verfügbar.", ephemeral: true });
        next.productId = product.id;
        confirmation = `Produkt gewählt: **${product.name}**`;
    } else {
        const method = guildConfig.paymentMethods.find(item => item.id === value && item.enabled);
        if (!method) return interaction.reply({ content: "❌ Diese Zahlungsart ist nicht verfügbar.", ephemeral: true });
        next.methodId = method.id;
        confirmation = `Zahlungsart gewählt: **${method.label}**`;
    }

    const needsProduct = guildConfig.products.some(item => item.inStock);
    const ready = next.methodId && (!needsProduct || next.productId);

    await interaction.deferUpdate();
    let saved = next;
    if (ready) {
        saved = await refreshSummary(interaction.channel, guildConfig, { ...next, status: "awaiting_payment" });
    }
    shopStore.saveOrder(interaction.guildId, interaction.channelId, saved);

    // Auswahl im Panel merken (Standardwert), damit man sieht, was gewählt ist
    try {
        await interaction.message.edit(buildPanel(guildConfig, saved));
    } catch (error) {
        console.warn("Shop-Panel konnte nicht aktualisiert werden:", error.message);
    }
    if (!ready) {
        await interaction.followUp({ content: `✅ ${confirmation}. Wähle noch den anderen Punkt aus.`, ephemeral: true });
    }
}

async function handlePaid(interaction) {
    const guildConfig = shopStore.getGuild(interaction.guildId);
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!order || order.userId !== interaction.user.id) {
        return interaction.reply({ content: "Nur der Besteller kann das auslösen.", ephemeral: true });
    }
    shopStore.saveOrder(interaction.guildId, interaction.channelId, { ...order, status: "paid_claimed" });
    const mentions = staffMentions(guildConfig.settings);
    await interaction.reply({
        content: `💸 <@${interaction.user.id}> hat bezahlt. ${mentions} bitte prüfen.`.trim(),
        allowedMentions: { users: [interaction.user.id], roles: guildConfig.settings.staffRoleIds }
    });
}

async function handleCodeButton(interaction) {
    const order = shopStore.getOrder(interaction.guildId, interaction.channelId);
    if (!order || order.userId !== interaction.user.id) {
        return interaction.reply({ content: "Nur der Besteller kann einen Code senden.", ephemeral: true });
    }
    const modal = new ModalBuilder()
        .setCustomId("shop:codemodal")
        .setTitle("Code senden")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("code")
                    .setLabel("Dein Code")
                    .setPlaceholder("Code hier einfügen")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(4)
                    .setMaxLength(100)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("note")
                    .setLabel("Notiz / Betrag (optional)")
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
    if (!order || order.userId !== interaction.user.id) {
        return interaction.reply({ content: "❌ Keine aktive Bestellung gefunden.", ephemeral: true });
    }

    const code = interaction.fields.getTextInputValue("code").trim();
    const note = interaction.fields.getTextInputValue("note")?.trim();
    const product = products.find(item => item.id === order.productId);
    const method = paymentMethods.find(item => item.id === order.methodId);

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("🔑 Neuer Code")
        .addFields(
            { name: "Kunde", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: "Ticket", value: `<#${interaction.channelId}>`, inline: true },
            { name: "Zahlungsart", value: method?.label || "—", inline: true },
            { name: "Produkt", value: product ? `${product.name}${product.price ? ` – ${product.price}` : ""}` : "—" },
            { name: "Code", value: `\`\`\`${code.replace(/`/g, "'")}\`\`\`` }
        )
        .setTimestamp();
    if (note) embed.addFields({ name: "Notiz", value: note.slice(0, 200) });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`shop:cok:${interaction.channelId}`).setLabel("Gültig / Bestätigt").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`shop:cbad:${interaction.channelId}`).setLabel("Ungültig").setEmoji("❌").setStyle(ButtonStyle.Danger)
    );
    const payload = {
        content: staffMentions(settings) || undefined,
        embeds: [embed],
        components: [buttons],
        allowedMentions: { roles: settings.staffRoleIds }
    };

    let delivered = "private";
    try {
        const codeChannel = settings.codeChannelId
            ? await interaction.guild.channels.fetch(settings.codeChannelId)
            : null;
        if (!codeChannel?.isTextBased()) throw new Error("Kein Code-Kanal eingestellt");
        await codeChannel.send(payload);
    } catch (error) {
        console.warn("Code-Kanal nicht erreichbar, sende ins Ticket:", error.message);
        delivered = "ticket";
        await interaction.channel.send(payload);
    }

    shopStore.saveOrder(interaction.guildId, interaction.channelId, {
        ...order,
        status: "code_sent",
        codeMasked: maskCode(code)
    });

    await interaction.channel.send({
        content: `🔑 <@${interaction.user.id}> hat einen Code gesendet. Das Team prüft ihn jetzt.`,
        allowedMentions: { users: [interaction.user.id] }
    });
    await interaction.editReply(
        delivered === "private"
            ? "✅ Dein Code wurde sicher an das Team gesendet."
            : "✅ Dein Code wurde an das Team gesendet (im Ticket, da noch kein privater Code-Kanal eingestellt ist)."
    );
}

async function handleCodeDecision(interaction) {
    const [, action, ticketChannelId] = interaction.customId.split(":");
    const settings = shopStore.getGuild(interaction.guildId).settings;
    if (!isStaff(interaction, settings)) {
        return interaction.reply({ content: "Nur das Team darf das.", ephemeral: true });
    }

    const approved = action === "cok";
    const order = shopStore.getOrder(interaction.guildId, ticketChannelId);
    if (order) {
        shopStore.saveOrder(interaction.guildId, ticketChannelId, { ...order, status: approved ? "paid" : "code_invalid" });
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(approved ? 0x57f287 : 0xed4245)
        .setFooter({ text: `${approved ? "Bestätigt" : "Als ungültig markiert"} von ${interaction.user.tag}` });
    await interaction.update({ embeds: [embed], components: [] });

    try {
        const ticket = await interaction.guild.channels.fetch(ticketChannelId);
        const userId = order?.userId;
        await ticket.send({
            content: approved
                ? `✅ ${userId ? `<@${userId}> ` : ""}Dein Code wurde bestätigt. Danke für deine Zahlung!`
                : `❌ ${userId ? `<@${userId}> ` : ""}Dein Code war ungültig. Bitte sende einen neuen Code über **Code senden** oder wähle eine andere Zahlungsart.`,
            allowedMentions: { users: userId ? [userId] : [] }
        });
    } catch (error) {
        await interaction.followUp({ content: "⚠️ Das Ticket konnte nicht benachrichtigt werden (evtl. schon gelöscht).", ephemeral: true });
    }
}

async function handleInteraction(interaction) {
    if (!interaction.guildId) {
        return interaction.reply({ content: "Nur auf einem Server möglich.", ephemeral: true });
    }
    const id = interaction.customId;

    if (interaction.isStringSelectMenu()) {
        if (id === "shop:product") return handleSelect(interaction, "product");
        if (id === "shop:pay") return handleSelect(interaction, "pay");
    }
    if (interaction.isButton()) {
        if (id === "shop:paid") return handlePaid(interaction);
        if (id === "shop:code") return handleCodeButton(interaction);
        if (id.startsWith("shop:cok:") || id.startsWith("shop:cbad:")) return handleCodeDecision(interaction);
    }
    if (interaction.isModalSubmit() && id === "shop:codemodal") return handleCodeModal(interaction);
}

// ---------- Katalog im Shop-Kanal ----------

async function postCatalog(client, guildId) {
    const guild = await client.guilds.fetch(guildId);
    const guildConfig = shopStore.getGuild(guildId);
    const { settings, products } = guildConfig;
    if (!settings.shopChannelId) throw new Error("Kein Shop-Kanal eingestellt.");

    const channel = await guild.channels.fetch(settings.shopChannelId);
    if (!channel?.isTextBased()) throw new Error("Der Shop-Kanal ist kein Textkanal.");

    // alte Katalog-Nachrichten entfernen
    const previous = guildConfig.shopMessages;
    if (previous?.channelId) {
        try {
            const oldChannel = await guild.channels.fetch(previous.channelId);
            for (const messageId of previous.messageIds) {
                await oldChannel.messages.delete(messageId).catch(() => {});
            }
        } catch (error) {
            // Kanal weg – egal
        }
    }

    const color = embedColor(settings);
    const header = new EmbedBuilder()
        .setColor(color)
        .setTitle(settings.shopTitle)
        .setDescription([settings.shopDescription, settings.buyInfo].filter(Boolean).join("\n\n") || null);

    const productEmbeds = products.map(product => {
        const embed = new EmbedBuilder()
            .setColor(product.inStock ? color : 0x747f8d)
            .setTitle(`${product.emoji ? `${product.emoji} ` : ""}${product.name}${product.inStock ? "" : " (ausverkauft)"}`)
            .setDescription(product.description || null);
        if (product.price) embed.addFields({ name: "Preis", value: product.price, inline: true });
        if (product.imageUrl) embed.setImage(product.imageUrl);
        return embed;
    });

    const embeds = [header, ...productEmbeds];
    const messageIds = [];
    for (let index = 0; index < embeds.length; index += 10) {
        const message = await channel.send({ embeds: embeds.slice(index, index + 10) });
        messageIds.push(message.id);
    }
    shopStore.setShopMessages(guildId, channel.id, messageIds);
    return { channelId: channel.id, products: products.length };
}

module.exports = {
    handleInteraction,
    isShopChannel,
    sendPanel,
    sendPanelWithRetry,
    postCatalog
};
