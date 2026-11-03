const { Events } = require("discord.js");
const ticketWelcome = require("../utils/ticketWelcome");
const ticketApplications = require("../utils/ticketApplications");

module.exports = {
    name: Events.ChannelDelete,

    execute(channel) {
        if (channel.guildId) {
            ticketWelcome.removeChannel(channel.guildId, channel.id);
            ticketApplications.removeChannel(channel.guildId, channel.id);
        }
    }
};
