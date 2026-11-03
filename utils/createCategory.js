const { ChannelType } = require("discord.js");

async function createCategory(guild, name) {

    let category = guild.channels.cache.find(
        c =>
            c.name === name &&
            c.type === ChannelType.GuildCategory
    );

    if (category) return category;

    category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory
    });

    console.log(`✅ Created category: ${name}`);

    return category;
}

module.exports = createCategory;