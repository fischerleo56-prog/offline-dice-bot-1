require("dotenv").config();

const express = require("express");
const app = express();

const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Webserver für Render
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Kenzy-Helfer is online!");
});

app.listen(PORT, () => {
    console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Commands laden
const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Events laden
const eventFiles = fs
    .readdirSync(path.join(__dirname, "events"))
    .filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.on("shardDisconnect", () => {
    console.log("❌ Discord Gateway getrennt");
});

client.on("shardReconnecting", () => {
    console.log("🔄 Discord Gateway verbindet neu...");
});

client.on("shardResume", () => {
    console.log("✅ Discord Verbindung wieder hergestellt");
});

client.on("disconnect", () => {
    console.log("❌ Discord Verbindung getrennt!");
});

client.on("reconnecting", () => {
    console.log("🔄 Bot versucht neu zu verbinden...");
});

client.on("error", (error) => {
    console.error("❌ Discord Fehler:", error);
});

client.on("invalidated", () => {
    console.log("❌ Discord Session ungültig");
});

process.on("uncaughtException", (error) => {
    console.error("💥 Ungefangener Fehler:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("💥 Unbehandelte Promise Ablehnung:", error);
});

setInterval(() => {
    console.log(
        `💚 Bot läuft noch | Discord: ${client.user ? client.user.tag : "NICHT VERBUNDEN"}`
    );
}, 60000);

client.login(process.env.TOKEN)
    .then(() => {
        console.log("✅ Login erfolgreich");
    })
    .catch((err) => {
        console.error("❌ Login Fehler:", err);
    });