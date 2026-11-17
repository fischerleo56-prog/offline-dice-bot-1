const fs = require("fs");
const path = require("path");

// Auf Render (Free) wird der Speicher bei jedem Deploy geleert.
// Mit DATA_DIR (z. B. einer Persistent Disk) bleiben die Daten erhalten.
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "shop.json");
let state;

const MAX_PRODUCTS = 25; // Limit eines Discord-Auswahlmenüs
const MAX_PAYMENTS = 25;
const MAX_ORDERS = 300;

function defaultPaymentMethods() {
    return [
        {
            id: "paysafe",
            label: "Paysafecard",
            emoji: "💳",
            enabled: true,
            askCode: true,
            instructions: "Schicke mir deinen Paysafecard-Code über den Button **Code senden**."
        },
        {
            id: "bank",
            label: "Banküberweisung",
            emoji: "🏦",
            enabled: true,
            askCode: false,
            instructions: "Überweise den Betrag an:\n**Empfänger:** (im Dashboard eintragen)\n**IBAN:** (im Dashboard eintragen)\n**Verwendungszweck:** (Ticket-Name)"
        },
        {
            id: "ltc",
            label: "Litecoin (LTC)",
            emoji: "🪙",
            enabled: true,
            askCode: false,
            instructions: "Sende den Betrag in LTC an diese Adresse:\n`(im Dashboard eintragen)`"
        },
        {
            id: "paypal",
            label: "PayPal",
            emoji: "🅿️",
            enabled: false,
            askCode: false,
            instructions: "Sende den Betrag per PayPal (Freunde & Familie) an: (im Dashboard eintragen)"
        },
        {
            id: "btc",
            label: "Bitcoin (BTC)",
            emoji: "₿",
            enabled: false,
            askCode: false,
            instructions: "Sende den Betrag in BTC an diese Adresse:\n`(im Dashboard eintragen)`"
        }
    ];
}

function defaultGuild() {
    return {
        settings: {
            shopChannelId: "",
            codeChannelId: "",
            ticketKeyword: "buy-ticket",
            staffRoleIds: [],
            color: "#5865f2",
            shopTitle: "🛒 Shop",
            shopDescription: "Hier siehst du alles, was du bei uns kaufen kannst.",
            buyInfo: "Zum Kaufen erstelle ein Ticket (Buy Ticket).",
            panelTitle: "💰 Bestellung",
            panelDescription: "Wähle unten dein Produkt und die Zahlungsart aus."
        },
        products: [],
        paymentMethods: defaultPaymentMethods(),
        orders: {},
        shopMessages: { channelId: "", messageIds: [] }
    };
}

function loadState() {
    if (state) return state;
    try {
        state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") console.error("❌ Shop-Daten konnten nicht geladen werden:", error);
        state = { guilds: {} };
    }
    if (!state.guilds || typeof state.guilds !== "object") state.guilds = {};
    return state;
}

function saveState() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(loadState(), null, 2), "utf8");
    fs.renameSync(temporaryFile, stateFile);
}

function getGuild(guildId) {
    const current = loadState();
    if (!current.guilds[guildId]) {
        current.guilds[guildId] = defaultGuild();
        saveState();
    }
    const guild = current.guilds[guildId];
    const defaults = defaultGuild();
    guild.settings = { ...defaults.settings, ...(guild.settings || {}) };
    if (!Array.isArray(guild.products)) guild.products = [];
    if (!Array.isArray(guild.paymentMethods)) guild.paymentMethods = defaults.paymentMethods;
    if (!guild.orders || typeof guild.orders !== "object") guild.orders = {};
    if (!guild.shopMessages) guild.shopMessages = defaults.shopMessages;
    return guild;
}

// ---------- Bereinigung der Eingaben aus dem Dashboard ----------

function text(value, max) {
    return String(value ?? "").trim().slice(0, max);
}

function snowflake(value) {
    const id = String(value ?? "").trim();
    return /^\d{15,25}$/.test(id) ? id : "";
}

function httpUrl(value) {
    const url = String(value ?? "").trim();
    return /^https?:\/\/\S+$/i.test(url) && url.length <= 500 ? url : "";
}

function emoji(value) {
    const e = String(value ?? "").trim();
    if (!e) return "";
    if (/^<a?:\w{2,32}:\d{15,25}>$/.test(e)) return e;
    // Unicode-Emoji: kurz und ohne normale Buchstaben/Ziffern
    if ([...e].length <= 8 && !/[A-Za-z0-9]/.test(e)) return e;
    return "";
}

function color(value) {
    const c = String(value ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#5865f2";
}

function slug(value, fallback) {
    const s = String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    return s || fallback;
}

function sanitizeSettings(input = {}, previous = {}) {
    return {
        shopChannelId: snowflake(input.shopChannelId),
        codeChannelId: snowflake(input.codeChannelId),
        ticketKeyword: text(input.ticketKeyword, 50).toLowerCase() || "buy-ticket",
        staffRoleIds: [...new Set((Array.isArray(input.staffRoleIds) ? input.staffRoleIds : []).map(snowflake).filter(Boolean))].slice(0, 10),
        color: color(input.color),
        shopTitle: text(input.shopTitle, 200) || previous.shopTitle || "🛒 Shop",
        shopDescription: text(input.shopDescription, 1500),
        buyInfo: text(input.buyInfo, 500),
        panelTitle: text(input.panelTitle, 200) || "💰 Bestellung",
        panelDescription: text(input.panelDescription, 1500)
    };
}

function sanitizeProducts(input) {
    const seen = new Set();
    const products = [];
    for (const [index, raw] of (Array.isArray(input) ? input : []).entries()) {
        const name = text(raw?.name, 100);
        if (!name) continue;
        let id = slug(raw.id, `p${Date.now().toString(36)}${index}`);
        while (seen.has(id)) id += "x";
        seen.add(id);
        products.push({
            id,
            name,
            description: text(raw.description, 1000),
            price: text(raw.price, 40),
            imageUrl: httpUrl(raw.imageUrl),
            emoji: emoji(raw.emoji),
            inStock: raw.inStock !== false
        });
        if (products.length >= MAX_PRODUCTS) break;
    }
    return products;
}

function sanitizePayments(input) {
    const seen = new Set();
    const methods = [];
    for (const [index, raw] of (Array.isArray(input) ? input : []).entries()) {
        const label = text(raw?.label, 80);
        if (!label) continue;
        let id = slug(raw.id, `m${Date.now().toString(36)}${index}`);
        while (seen.has(id)) id += "x";
        seen.add(id);
        methods.push({
            id,
            label,
            emoji: emoji(raw.emoji),
            enabled: raw.enabled !== false,
            askCode: Boolean(raw.askCode),
            instructions: text(raw.instructions, 1500)
        });
        if (methods.length >= MAX_PAYMENTS) break;
    }
    return methods;
}

// ---------- Schreibzugriffe ----------

function updateGuild(guildId, updater) {
    const guild = getGuild(guildId);
    updater(guild);
    saveState();
    return guild;
}

function setSettings(guildId, input) {
    return updateGuild(guildId, guild => { guild.settings = sanitizeSettings(input, guild.settings); });
}

function setProducts(guildId, input) {
    return updateGuild(guildId, guild => { guild.products = sanitizeProducts(input); });
}

function setPayments(guildId, input) {
    return updateGuild(guildId, guild => { guild.paymentMethods = sanitizePayments(input); });
}

function getOrder(guildId, channelId) {
    return getGuild(guildId).orders[channelId] || null;
}

function saveOrder(guildId, channelId, order) {
    return updateGuild(guildId, guild => {
        guild.orders[channelId] = { ...order, updatedAt: new Date().toISOString() };
        const keys = Object.keys(guild.orders);
        if (keys.length > MAX_ORDERS) {
            keys
                .sort((a, b) => String(guild.orders[a].createdAt).localeCompare(String(guild.orders[b].createdAt)))
                .slice(0, keys.length - MAX_ORDERS)
                .forEach(key => delete guild.orders[key]);
        }
    }).orders[channelId];
}

function setShopMessages(guildId, channelId, messageIds) {
    updateGuild(guildId, guild => { guild.shopMessages = { channelId, messageIds }; });
}

function markChannelDeleted(guildId, channelId) {
    const current = loadState().guilds[guildId];
    const order = current?.orders?.[channelId];
    if (!order) return;
    order.status = order.status === "paid" ? "paid" : "closed";
    order.channelDeleted = true;
    saveState();
}

module.exports = {
    getGuild,
    setSettings,
    setProducts,
    setPayments,
    getOrder,
    saveOrder,
    setShopMessages,
    markChannelDeleted,
    sanitizeSettings,
    sanitizeProducts,
    sanitizePayments
};
