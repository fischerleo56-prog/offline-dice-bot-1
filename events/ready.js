const { Events } = require("discord.js");
const registerCommands = require("../utils/registerCommands");
const botSettings = require("../utils/botSettings");

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        console.log(`✅ ${client.user.tag} is online!`);
        botSettings.apply(client); // Status-Text ist im Dashboard änderbar

        try {
            const applicationId = client.application?.id || process.env.CLIENT_ID;
            const commands = [...client.commands.values()];
            console.log(`🔄 Registriere ${commands.length} globale Slash-Befehle: ${commands.map(command => `/${command.data.name}`).join(", ")}`);
            const commandCount = await registerCommands(
                commands,
                applicationId,
                process.env.TOKEN
            );
            console.log(`✅ ${commandCount} globale Slash-Befehle registriert.`);
        } catch (error) {
            console.error("❌ Slash-Befehle konnten nicht registriert werden:", error);
        }
    }
};
