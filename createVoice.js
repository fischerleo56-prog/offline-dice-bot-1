const { ChannelType } = require("discord.js");

async function createVoice(guild, options) {

    let channel = guild.channels.cache.find(
        c => c.name === options.name
    );

    if (channel) return channel;

    channel = await guild.channels.create({
        name: options.name,
        type: ChannelType.GuildVoice,
        parent: options.parent ?? null,
        permissionOverwrites: options.permissionOverwrites ?? []
    });

    console.log(`✅ Created voice channel: ${options.name}`);

    return channel;
}

module.exports = createVoice;