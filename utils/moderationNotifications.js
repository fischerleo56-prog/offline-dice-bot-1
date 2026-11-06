const { EmbedBuilder } = require("discord.js");

async function sendModerationDM(user, details) {
    const embed = new EmbedBuilder()
        .setColor(details.color || 0x5865f2)
        .setTitle(details.title)
        .setDescription(details.description)
        .addFields(
            { name: "Server", value: details.guildName || "Discord server", inline: true },
            { name: "Moderator", value: details.moderator || "Server staff", inline: true },
            { name: "Reason", value: String(details.reason || "No reason provided.").slice(0, 1024) }
        )
        .setTimestamp();

    if (details.duration) {
        embed.addFields({ name: "Duration", value: details.duration, inline: true });
    }

    try {
        await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
        return true;
    } catch (error) {
        console.warn(`Could not send moderation DM to ${user.id}:`, error.message);
        return false;
    }
}

module.exports = { sendModerationDM };
