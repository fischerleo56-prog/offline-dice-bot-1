const { Events } = require("discord.js");
const ticketWelcome = require("../utils/ticketWelcome");
const ticketApplications = require("../utils/ticketApplications");

// Offizielle Ticket-King-Bot-ID; so werden normale Serverkanäle nicht als Tickets behandelt.
const TICKET_KING_BOT_ID = "710034409214181396";
const ticketInfoCache = new Map();
const channelsSendingWelcome = new Set();
const channelsSendingApplicationPanel = new Set();

async function getTicketInfo(channel, knownTicketKingMessage = null) {
    const cached = ticketInfoCache.get(channel.id);
    if (!knownTicketKingMessage && (cached?.kind || cached?.isTicket === false)) return cached;

    let messages;
    if (knownTicketKingMessage) {
        messages = [knownTicketKingMessage];
    } else {
        try {
            messages = [...(await channel.messages.fetch({ limit: 50 })).values()];
        } catch (error) {
            console.error(`❌ Ticket-King-Ticket in Kanal ${channel.id} konnte nicht erkannt werden:`, error);
            return cached || { isTicket: false, kind: null };
        }
    }

    const isTicket = Boolean(cached?.isTicket)
        || messages.some(message => message.author.id === TICKET_KING_BOT_ID && !isTicketPanelMessage(message));
    if (!isTicket) {
        ticketInfoCache.set(channel.id, { isTicket: false, kind: null });
        return { isTicket: false, kind: null };
    }

    const kind = ticketApplications.detectApplicationType(channel, messages);
    const info = { isTicket: true, kind: kind || cached?.kind || null };
    // Cache only a positive category match; Ticket King may post the category in a later message.
    if (info.kind) ticketInfoCache.set(channel.id, info);
    else ticketInfoCache.delete(channel.id);
    return info;
}

function isTicketPanelMessage(message) {
    const text = [message.content, ...(message.embeds || []).flatMap(embed => [embed.title, embed.description])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const components = (message.components || []).flatMap(row => row.components || []);
    const hasSelectComponent = components.some(component => Array.isArray(component.options));
    const hasOpeningPrompt = /open a ticket|create a ticket|select an option|choose an option/.test(text);
    return hasSelectComponent || (components.length > 0 && hasOpeningPrompt);
}

async function sendApplicationPanel(channel, guildId, kind) {
    if (!kind || ticketApplications.getChannelState(guildId, channel.id)?.applicationPanelSent) return;
    if (channelsSendingApplicationPanel.has(channel.id)) return;

    channelsSendingApplicationPanel.add(channel.id);
    try {
        const panel = await channel.send(ticketApplications.buildApplicationPanel());
        ticketApplications.updateChannelState(guildId, channel.id, {
            applicationPanelSent: true,
            applicationKind: "both",
            detectedTicketKind: kind,
            applicationPanelMessageId: panel.id
        });
    } catch (error) {
        console.error(`❌ Bewerbungspanel für Ticket ${channel.id} konnte nicht gesendet werden:`, error);
    } finally {
        channelsSendingApplicationPanel.delete(channel.id);
    }
}

async function sendWelcomeMessage(message, config) {
    if (!config?.message) return;
    if (ticketWelcome.hasWelcomedChannel(message.guild.id, message.channel.id)) return;
    if (channelsSendingWelcome.has(message.channel.id)) return;

    channelsSendingWelcome.add(message.channel.id);
    try {
        const displayName = message.member?.displayName || message.author.username;
        const content = config.message
            .replaceAll("{user}", `<@${message.author.id}>`)
            .replaceAll("{username}", displayName);

        await message.channel.send({
            content,
            allowedMentions: {
                parse: [],
                users: [message.author.id]
            }
        });

        ticketWelcome.markWelcomedChannel(message.guild.id, message.channel.id);
    } catch (error) {
        console.error(`❌ Willkommensnachricht für Ticket ${message.channel.id} konnte nicht gesendet werden:`, error);
    } finally {
        channelsSendingWelcome.delete(message.channel.id);
    }
}

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        if (!message.guild || message.webhookId) return;
        if (!message.channel.isTextBased() || !message.channel.messages) return;

        if (message.author.id === TICKET_KING_BOT_ID) {
            const info = await getTicketInfo(message.channel, message);
            if (info.isTicket) {
                await sendApplicationPanel(message.channel, message.guild.id, info.kind);
            }
            return;
        }

        if (message.author.bot) return;

        const config = ticketWelcome.getGuildConfig(message.guild.id);
        const needsTicketCheck = !ticketWelcome.hasWelcomedChannel(message.guild.id, message.channel.id)
            || !ticketApplications.getChannelState(message.guild.id, message.channel.id)?.applicationPanelSent;
        if (!needsTicketCheck) return;

        const info = await getTicketInfo(message.channel);
        if (!info.isTicket) return;

        await sendApplicationPanel(message.channel, message.guild.id, info.kind);
        await sendWelcomeMessage(message, config);
    }
};
