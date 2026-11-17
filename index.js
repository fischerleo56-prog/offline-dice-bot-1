require("dotenv").config();

const express = require("express");
const app = express();

const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Web server (Railway / Render)
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Kenzy-Helfer is online!");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Web dashboard (/dashboard)
require("./utils/dashboardServer")(app, client);

client.commands = new Collection();

// Load commands
const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Load events
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
    console.log("❌ Discord gateway disconnected");
});

client.on("shardReconnecting", () => {
    console.log("🔄 Discord gateway reconnecting...");
});

client.on("shardResume", () => {
    console.log("✅ Discord connection restored");
});

client.on("disconnect", () => {
    console.log("❌ Discord connection lost!");
});

client.on("reconnecting", () => {
    console.log("🔄 Bot is trying to reconnect...");
});

client.on("error", (error) => {
    console.error("❌ Discord error:", error);
});

client.on("invalidated", () => {
    console.log("❌ Discord session invalid");
});

process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("💥 Unhandled promise rejection:", error);
});

setInterval(() => {
    console.log(
        `💚 Bot is still running | Discord: ${client.user ? client.user.tag : "NOT CONNECTED"}`
    );
}, 60000);

client.login(process.env.TOKEN)
    .then(() => {
        console.log("✅ Login successful");
    })
    .catch((err) => {
        console.error("❌ Login error:", err);
    });