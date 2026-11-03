const { REST, Routes } = require("discord.js");

async function registerCommands(commands, applicationId, token) {
    if (!token) throw new Error("TOKEN fehlt in der .env-Datei.");
    if (!applicationId) throw new Error("CLIENT_ID konnte nicht ermittelt werden.");
    if (!Array.isArray(commands) || commands.length === 0) {
        throw new Error("Es wurden keine Slash-Befehle zum Registrieren gefunden.");
    }

    const rest = new REST({ version: "10" }).setToken(token);
    const commandData = commands.map(command => command.data.toJSON());
    const route = Routes.applicationCommands(applicationId);

    try {
        await rest.put(route, { body: commandData });
    } catch (error) {
        const details = error.rawError
            ? JSON.stringify(error.rawError, null, 2)
            : error.message;
        throw new Error(`Discord hat die globale Registrierung abgelehnt: ${details}`, { cause: error });
    }

    return commandData.length;
}

module.exports = registerCommands;
