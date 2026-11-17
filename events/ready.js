const { Events } = require("discord.js");
const registerCommands = require("../utils/registerCommands");
const botSettings = require("../utils/botSettings");

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        console.log(`✅ ${client.user.tag} is online!`);
        botSettings.apply(client); // status text can be changed in the dashboard

        try {
            const applicationId = client.application?.id || process.env.CLIENT_ID;
            const commands = [...client.commands.values()];
            console.log(`🔄 Registering ${commands.length} global slash commands: ${commands.map(command => `/${command.data.name}`).join(", ")}`);
            const commandCount = await registerCommands(
                commands,
                applicationId,
                process.env.TOKEN
            );
            console.log(`✅ ${commandCount} global slash commands registered.`);
        } catch (error) {
            console.error("❌ Slash commands could not be registered:", error);
        }
    }
};
