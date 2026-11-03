const { PermissionFlagsBits } = require("discord.js");

function everyoneReadOnly(guild) {
    return [
        {
            id: guild.roles.everyone.id,
            deny: [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.SendMessagesInThreads
            ]
        }
    ];
}

function streamerOnly(guild, streamerRole) {
    return [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.Connect]
        },
        {
            id: streamerRole.id,
            allow: [PermissionFlagsBits.Connect]
        }
    ];
}

module.exports = {
    everyoneReadOnly,
    streamerOnly
};