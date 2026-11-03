require("dotenv").config();

const fs = require("fs");
const path = require("path");
const registerCommands = require("./utils/registerCommands");

const commands = [];

const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    console.log(`✅ Loaded command: ${command.data.name}`);

    commands.push(command);
}

(async () => {
    try {
        console.log(`🔄 Registering ${commands.length} global commands...`);

        const commandCount = await registerCommands(
            commands,
            process.env.CLIENT_ID,
            process.env.TOKEN
        );

        console.log(`✅ ${commandCount} global commands registered.`);
    } catch (error) {
        console.error("❌ Command registration failed:", error);
        process.exitCode = 1;
    }
})();
