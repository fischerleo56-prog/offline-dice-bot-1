const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "ticket-welcome.json");
let state;

function loadState() {
    if (state) return state;

    try {
        state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("❌ Ticket-Willkommensnachrichten konnten nicht geladen werden:", error);
        }

        state = { guilds: {} };
    }

    if (!state.guilds || typeof state.guilds !== "object") {
        state.guilds = {};
    }

    return state;
}

function saveState() {
    fs.mkdirSync(dataDirectory, { recursive: true });

    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(loadState(), null, 2), "utf8");
    fs.renameSync(temporaryFile, stateFile);
}

function getGuildConfig(guildId) {
    const guild = loadState().guilds[guildId];

    if (!guild) return null;

    return {
        message: guild.message || "",
        welcomedChannels: Array.isArray(guild.welcomedChannels)
            ? guild.welcomedChannels
            : []
    };
}

function setWelcomeMessage(guildId, message) {
    const currentState = loadState();
    const guild = currentState.guilds[guildId] || { welcomedChannels: [] };

    guild.message = message;
    if (!Array.isArray(guild.welcomedChannels)) guild.welcomedChannels = [];
    currentState.guilds[guildId] = guild;
    saveState();
}

function hasWelcomedChannel(guildId, channelId) {
    const guild = loadState().guilds[guildId];
    return Boolean(guild?.welcomedChannels?.includes(channelId));
}

function markWelcomedChannel(guildId, channelId) {
    const currentState = loadState();
    const guild = currentState.guilds[guildId];

    if (!guild) return;
    if (!Array.isArray(guild.welcomedChannels)) guild.welcomedChannels = [];
    if (!guild.welcomedChannels.includes(channelId)) {
        guild.welcomedChannels.push(channelId);
        saveState();
    }
}

function removeChannel(guildId, channelId) {
    const currentState = loadState();
    const guild = currentState.guilds[guildId];

    if (!guild || !Array.isArray(guild.welcomedChannels)) return;

    const updatedChannels = guild.welcomedChannels.filter(id => id !== channelId);
    if (updatedChannels.length === guild.welcomedChannels.length) return;

    guild.welcomedChannels = updatedChannels;
    saveState();
}

module.exports = {
    getGuildConfig,
    hasWelcomedChannel,
    markWelcomedChannel,
    removeChannel,
    setWelcomeMessage
};
