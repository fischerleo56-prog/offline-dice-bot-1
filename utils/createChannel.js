const { ChannelType } = require("discord.js");

async function createChannel(guild, options) {

    let channel = guild.channels.cache.find(
        c => c.name === options.name
    );

    // Kanal existiert bereits → Einstellungen aktualisieren
    if (channel) {

        await channel.edit({
            parent: options.parent ?? channel.parentId,
            topic: options.topic ?? channel.topic
        });

        // Berechtigungen aktualisieren
        if (options.permissionOverwrites) {
            await channel.permissionOverwrites.set(
                options.permissionOverwrites
            );
        }

        console.log(`🔄 Updated channel: ${options.name}`);

        return channel;
    }

    // Kanal existiert nicht → erstellen
    channel = await guild.channels.create({
        name: options.name,
        type: options.type || ChannelType.GuildText,
        parent: options.parent ?? null,
        topic: options.topic ?? null,
        permissionOverwrites: options.permissionOverwrites ?? []
    });

    console.log(`✅ Created channel: ${options.name}`);

    return channel;
}

module.exports = createChannel;
