const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { ChannelType } = require("discord.js");

const shopStore = require("./shopStore");
const shopTickets = require("./shopTickets");
const serverTickets = require("./serverTickets");
const ticketWelcome = require("./ticketWelcome");
const botSettings = require("./botSettings");

const COOKIE = "dash_session";
const SESSION_MS = 12 * 60 * 60 * 1000;

function safeEqual(a, b) {
    const left = crypto.createHash("sha256").update(String(a)).digest();
    const right = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(left, right);
}

module.exports = function mountDashboard(app, client) {
    const password = process.env.DASHBOARD_PASSWORD;
    const secret = crypto
        .createHash("sha256")
        .update(`${process.env.DASHBOARD_SECRET || password || ""}|dashboard`)
        .digest("hex");
    const page = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf8");

    if (!password || password.length < 8) {
        console.warn("⚠️ DASHBOARD_PASSWORD fehlt (mind. 8 Zeichen) – das Web-Dashboard ist deaktiviert.");
        app.use(["/dashboard", "/api/dashboard"], (req, res) => {
            res.status(503).send("Dashboard deaktiviert: Setze DASHBOARD_PASSWORD (mind. 8 Zeichen) in den Umgebungsvariablen.");
        });
        return;
    }

    // ----- Session (signiertes Cookie) -----
    const sign = value => crypto.createHmac("sha256", secret).update(value).digest("hex");

    function readCookie(req, name) {
        const header = req.headers.cookie || "";
        for (const part of header.split(";")) {
            const [key, ...rest] = part.trim().split("=");
            if (key === name) return decodeURIComponent(rest.join("="));
        }
        return "";
    }

    function isLoggedIn(req) {
        const [expires, signature] = readCookie(req, COOKIE).split(".");
        if (!expires || !signature || Number(expires) < Date.now()) return false;
        return safeEqual(signature, sign(expires));
    }

    const attempts = new Map();
    function tooManyAttempts(ip) {
        const now = Date.now();
        const recent = (attempts.get(ip) || []).filter(time => now - time < 10 * 60 * 1000);
        attempts.set(ip, recent);
        return recent.length >= 8;
    }

    const api = express.Router();
    api.use(express.json({ limit: "300kb" }));

    api.post("/login", (req, res) => {
        const ip = req.ip;
        if (tooManyAttempts(ip)) return res.status(429).json({ error: "Zu viele Versuche. Warte 10 Minuten." });
        if (!safeEqual(req.body?.password ?? "", password)) {
            attempts.get(ip).push(Date.now());
            return res.status(401).json({ error: "Falsches Passwort." });
        }
        const expires = String(Date.now() + SESSION_MS);
        const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
        res.setHeader(
            "Set-Cookie",
            `${COOKIE}=${expires}.${sign(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? "; Secure" : ""}`
        );
        res.json({ ok: true });
    });

    api.post("/logout", (req, res) => {
        res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        res.json({ ok: true });
    });

    // Alles ab hier nur eingeloggt; Änderungen brauchen zusätzlich den Header (CSRF-Schutz).
    api.use((req, res, next) => {
        if (!isLoggedIn(req)) return res.status(401).json({ error: "Nicht eingeloggt." });
        if (req.method !== "GET" && req.headers["x-dashboard"] !== "1") {
            return res.status(403).json({ error: "Ungültige Anfrage." });
        }
        next();
    });

    const wrap = handler => (req, res) => {
        Promise.resolve(handler(req, res)).catch(error => {
            console.error("Dashboard-Fehler:", error);
            res.status(400).json({ error: error.message || "Fehler" });
        });
    };

    async function getGuildOrThrow(req) {
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) throw new Error("Server nicht gefunden (ist der Bot dort?).");
        return guild;
    }

    api.get("/guilds", wrap((req, res) => {
        res.json({
            botOnline: Boolean(client.user),
            botName: client.user?.tag || null,
            guilds: [...client.guilds.cache.values()].map(guild => ({ id: guild.id, name: guild.name }))
        });
    }));

    api.get("/guild/:id", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        await guild.channels.fetch();
        await guild.roles.fetch();
        const data = shopStore.getGuild(guild.id);
        const channels = [...guild.channels.cache.values()]
            .filter(channel => channel.type === ChannelType.GuildText)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(channel => ({ id: channel.id, name: channel.name }));
        const roles = [...guild.roles.cache.values()]
            .filter(role => role.id !== guild.roles.everyone.id && !role.managed)
            .sort((a, b) => b.position - a.position)
            .map(role => ({ id: role.id, name: role.name }));
        const orders = Object.values(data.orders)
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 100);
        res.json({
            settings: data.settings,
            products: data.products,
            paymentMethods: data.paymentMethods,
            orders,
            channels,
            roles,
            welcomeMessage: ticketWelcome.getGuildConfig(guild.id)?.message || "",
            bot: botSettings.get()
        });
    }));

    api.put("/guild/:id/settings", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        res.json(shopStore.setSettings(guild.id, req.body).settings);
    }));

    api.put("/guild/:id/products", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        res.json(shopStore.setProducts(guild.id, req.body?.products).products);
    }));

    api.put("/guild/:id/payments", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        res.json(shopStore.setPayments(guild.id, req.body?.paymentMethods).paymentMethods);
    }));

    api.post("/guild/:id/post-catalog", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        res.json(await shopTickets.postCatalog(client, guild.id));
    }));

    api.put("/guild/:id/welcome", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        ticketWelcome.setWelcomeMessage(guild.id, String(req.body?.message ?? "").slice(0, 2000));
        res.json({ ok: true });
    }));

    api.put("/bot", wrap((req, res) => {
        const settings = botSettings.set(req.body || {});
        botSettings.apply(client);
        res.json(settings);
    }));

    api.post("/guild/:id/post-ticketpanel", wrap(async (req, res) => {
        const guild = await getGuildOrThrow(req);
        const channel = await guild.channels.fetch(String(req.body?.channelId || ""));
        if (!channel || channel.type !== ChannelType.GuildText) throw new Error("Bitte einen Textkanal wählen.");
        const roleIds = [...new Set((req.body?.roleIds || []).map(String))]
            .filter(id => id !== guild.roles.everyone.id && guild.roles.cache.has(id));
        if (!roleIds.length) throw new Error("Bitte mindestens eine Team-Rolle wählen.");
        await channel.send(serverTickets.buildPanel(roleIds));
        res.json({ ok: true });
    }));

    app.use("/api/dashboard", api);
    app.get("/dashboard", (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Frame-Options", "DENY");
        res.type("html").send(page);
    });

    console.log("🖥️ Web-Dashboard erreichbar unter /dashboard");
};
