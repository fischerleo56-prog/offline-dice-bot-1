const fs = require("fs");
const path = require("path");

// Without a persistent volume the data is wiped on every deploy.
// Set DATA_DIR (e.g. a Railway volume mounted at /data) to keep it.
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "shop.json");
let state;

const MAX_PRODUCTS = 25; // Discord select menu limit
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
            instructions: "Send your Paysafecard code with the **Send code** button below."
        },
        {
            id: "bank",
            label: "Bank transfer",
            emoji: "🏦",
            enabled: true,
            askCode: false,
            instructions: "Transfer the amount to:\n**Recipient:** (set in dashboard)\n**IBAN:** (set in dashboard)\n**Reference:** (ticket name)"
        },
        {
            id: "ltc",
            label: "Litecoin (LTC)",
            emoji: "🪙",
            enabled: true,
            askCode: false,
            instructions: "Send the amount in LTC to this address:\n`(set in dashboard)`"
        },
        {
            id: "paypal",
            label: "PayPal",
            emoji: "🅿️",
            enabled: false,
            askCode: false,
            instructions: "Send the amount via PayPal (Friends & Family) to: (set in dashboard)"
        },
        {
            id: "btc",
            label: "Bitcoin (BTC)",
            emoji: "₿",
            enabled: false,
            askCode: false,
            instructions: "Send the amount in BTC to this address:\n`(set in dashboard)`"
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
            shopDescription: "Here you can see everything available to buy.",
            buyInfo: "To buy, open a ticket (Buy Ticket).",
            panelTitle: "💰 Order",
            panelDescription: "Choose your product and payment method below."
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
        if (error.code !== "ENOENT") console.error("❌ Shop data could not be loaded:", error);
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

// ---------- Sanitizing input from the dashboard ----------

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
    // Unicode emoji: short and without normal letters/digits
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
        panelTitle: text(input.panelTitle, 200) || "💰 Order",
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
        // stock: empty = unlimited (manual "in stock" switch), number = tracked quantity
        const rawStock = raw.stock === "" || raw.stock == null ? null : Math.floor(Number(raw.stock));
        const stock = Number.isFinite(rawStock) && rawStock >= 0 ? Math.min(rawStock, 1000000) : null;
        products.push({
            id,
            name,
            description: text(raw.description, 1000),
            price: text(raw.price, 40),
            imageUrl: httpUrl(raw.imageUrl),
            emoji: emoji(raw.emoji),
            stock,
            inStock: stock !== null ? stock > 0 : raw.inStock !== false
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

// ---------- Writes ----------

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

// Reduce stock of a tracked product. Returns { product, stock } (stock null = unlimited).
function adjustStock(guildId, productId, delta) {
    let result = null;
    updateGuild(guildId, guild => {
        const product = guild.products.find(item => item.id === productId);
        if (!product) return;
        if (typeof product.stock === "number") {
            product.stock = Math.max(0, product.stock + delta);
            product.inStock = product.stock > 0;
        }
        result = { product: { ...product }, stock: typeof product.stock === "number" ? product.stock : null };
    });
    return result;
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
    adjustStock,
    setShopMessages,
    markChannelDeleted,
    sanitizeSettings,
    sanitizeProducts,
    sanitizePayments
};
