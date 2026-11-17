const { Events } = require("discord.js");
const shopTickets = require("../utils/shopTickets");

module.exports = {
    name: Events.ChannelCreate,

    async execute(channel) {
        if (!channel.guildId) return;
        // Panel nur in Kanälen, deren Name das Ticket-Stichwort enthält (z. B. "228-buy-ticket")
        await shopTickets.sendPanelWithRetry(channel).catch(error => {
            console.error("❌ Shop-Panel Fehler:", error);
        });
    }
};
