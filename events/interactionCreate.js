const { Events, AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const ticketApplications = require("../utils/ticketApplications");
const serverTickets = require("../utils/serverTickets");

async function handleTicketButton(interaction) {
    const [, action, kind] = interaction.customId.split(":");

    if (action === "start") {
        const channelState = ticketApplications.getChannelState(interaction.guildId, interaction.channelId);
        if (!channelState?.applicationPanelSent || kind !== "both") {
            return interaction.reply({
                content: "This application form is not available in this ticket.",
                ephemeral: true
            });
        }

        const existing = channelState.application;
        if (existing && existing.applicantId !== interaction.user.id) {
            return interaction.reply({
                content: `This ticket already contains an application from <@${existing.applicantId}>.`,
                allowedMentions: { users: [] },
                ephemeral: true
            });
        }
        if (existing && !["needs_info", "rejected", "in_progress"].includes(existing.status)) {
            return interaction.reply({
                content: "Your application is already submitted. Staff can request more information if needed.",
                ephemeral: true
            });
        }

        return interaction.showModal(ticketApplications.createApplicationModal("first"));
    }

    if (action === "continue") {
        const application = ticketApplications.getChannelState(interaction.guildId, interaction.channelId)?.application;
        if (!application || application.status !== "in_progress" || application.applicantId !== interaction.user.id) {
            return interaction.reply({
                content: "There is no unfinished application for you in this ticket.",
                ephemeral: true
            });
        }

        return interaction.showModal(ticketApplications.createApplicationModal("final"));
    }

    const channelState = ticketApplications.getChannelState(interaction.guildId, interaction.channelId);
    const application = channelState?.application;
    if (!application) {
        return interaction.reply({ content: "There is no submitted application in this ticket yet.", ephemeral: true });
    }
    if (!ticketApplications.isTicketStaff(interaction)) {
        return interaction.reply({
            content: "This action is available to ticket staff only.",
            ephemeral: true
        });
    }
    if (application.status === "in_progress") {
        return interaction.reply({
            content: "This application is incomplete. Staff actions unlock after all six questions are submitted.",
            ephemeral: true
        });
    }

    if (action === "claim") {
        if (application.claimedBy && application.claimedBy !== interaction.user.id) {
            return interaction.reply({
                content: `This application is already claimed by <@${application.claimedBy}>.`,
                allowedMentions: { users: [] },
                ephemeral: true
            });
        }

        const updated = {
            ...application,
            claimedBy: interaction.user.id,
            status: application.status === "pending" ? "claimed" : application.status
        };
        ticketApplications.saveApplication(interaction.guildId, interaction.channelId, updated);
        return interaction.update({
            embeds: [ticketApplications.buildApplicationEmbed(updated)],
            components: ticketApplications.buildReviewButtons(updated)
        });
    }

    if (action === "approve" || action === "reject" || action === "more-info") {
        const status = action === "approve"
            ? "approved"
            : action === "reject"
                ? "rejected"
                : "needs_info";
        const updated = { ...application, status, decidedBy: interaction.user.id };
        ticketApplications.saveApplication(interaction.guildId, interaction.channelId, updated);

        await interaction.update({
            embeds: [ticketApplications.buildApplicationEmbed(updated)],
            components: ticketApplications.buildReviewButtons(updated)
        });

        const messages = {
            approved: `✅ <@${application.applicantId}>, your application was approved. A staff member will follow up with you here.`,
            rejected: `❌ <@${application.applicantId}>, your application was declined. Please contact staff if you have questions.`,
            needs_info: `📝 <@${application.applicantId}>, staff need a little more information. Please use the application button above to submit an updated form.`
        };
        await interaction.channel.send({
            content: messages[status],
            allowedMentions: { users: [application.applicantId] }
        });
        return;
    }

    if (action === "close") {
        await interaction.deferUpdate();

        const overwrite = interaction.channel.permissionOverwrites.cache.get(application.applicantId);
        const sendMessages = overwrite?.allow.has(PermissionFlagsBits.SendMessages)
            ? true
            : overwrite?.deny.has(PermissionFlagsBits.SendMessages)
                ? false
                : null;
        let transcript;
        try {
            transcript = await ticketApplications.createTranscript(interaction.channel);
            await interaction.channel.permissionOverwrites.edit(application.applicantId, {
                SendMessages: false
            });
        } catch (error) {
            console.error(`❌ Ticket ${interaction.channelId} konnte nicht geschlossen werden:`, error);
            return interaction.followUp({
                content: "The ticket could not be closed. Check that the bot can read the channel and manage its permissions.",
                ephemeral: true
            });
        }

        const updated = {
            ...application,
            statusBeforeClose: application.status,
            permissionSnapshot: { sendMessages },
            status: "closed",
            closedBy: interaction.user.tag,
            closedAt: new Date().toISOString()
        };
        ticketApplications.saveApplication(interaction.guildId, interaction.channelId, updated);
        await interaction.message.edit({
            embeds: [ticketApplications.buildApplicationEmbed(updated)],
            components: ticketApplications.buildReviewButtons(updated)
        });
        await interaction.channel.send({
            content: `🔒 Ticket closed by <@${interaction.user.id}>. A transcript is attached.`,
            files: [new AttachmentBuilder(transcript, { name: `${interaction.channel.name}-transcript.txt` })],
            allowedMentions: { users: [interaction.user.id] }
        });
        return;
    }

    if (action === "reopen") {
        const snapshot = application.permissionSnapshot || {};
        try {
            await interaction.channel.permissionOverwrites.edit(application.applicantId, {
                SendMessages: snapshot.sendMessages ?? null
            });
        } catch (error) {
            console.error(`❌ Ticket ${interaction.channelId} konnte nicht wieder geöffnet werden:`, error);
            return interaction.reply({
                content: "The ticket could not be reopened. Check that the bot can manage channel permissions.",
                ephemeral: true
            });
        }

        const updated = {
            ...application,
            status: application.statusBeforeClose || "pending",
            closedBy: null,
            closedAt: null,
            statusBeforeClose: null,
            permissionSnapshot: null
        };
        ticketApplications.saveApplication(interaction.guildId, interaction.channelId, updated);
        await interaction.update({
            embeds: [ticketApplications.buildApplicationEmbed(updated)],
            components: ticketApplications.buildReviewButtons(updated)
        });
        await interaction.channel.send({
            content: `🔓 Ticket reopened by <@${interaction.user.id}>.`,
            allowedMentions: { users: [interaction.user.id] }
        });
    }
}

async function handleTicketModal(interaction) {
    const [, , page] = interaction.customId.split(":");
    const channelState = ticketApplications.getChannelState(interaction.guildId, interaction.channelId);
    if (!channelState?.applicationPanelSent) {
        return interaction.reply({
            content: "This application form is not available in this ticket.",
            ephemeral: true
        });
    }

    const existing = channelState.application;
    if (page === "first") {
        if (existing && existing.applicantId !== interaction.user.id) {
            return interaction.reply({ content: "This ticket already contains another user's application.", ephemeral: true });
        }
        if (existing && !["needs_info", "rejected", "in_progress"].includes(existing.status)) {
            return interaction.reply({ content: "Your application is already submitted.", ephemeral: true });
        }

        const answers = Object.fromEntries(
            ticketApplications.getApplicationQuestions().slice(0, 5).map(question => [
                question.id,
                interaction.fields.getTextInputValue(question.id).trim()
            ])
        );
        if (Object.values(answers).some(answer => !answer)) {
            return interaction.reply({ content: "Please answer every required question before continuing.", ephemeral: true });
        }

        const application = {
            kind: "both",
            applicantId: interaction.user.id,
            answers,
            status: "in_progress",
            claimedBy: existing?.claimedBy || null,
            submittedAt: new Date().toISOString(),
            decidedBy: null,
            reviewMessageId: existing?.reviewMessageId || null
        };
        ticketApplications.saveApplication(interaction.guildId, interaction.channelId, application);
        return interaction.reply({
            content: "✅ Five answers saved. Continue to the final required question to submit your application.",
            components: [ticketApplications.buildContinueButton()],
            ephemeral: true
        });
    }

    if (page !== "final" || !existing || existing.status !== "in_progress"
        || existing.applicantId !== interaction.user.id) {
        return interaction.reply({ content: "There is no unfinished application for this question.", ephemeral: true });
    }

    const finalQuestion = ticketApplications.getApplicationQuestions()[5];
    const finalAnswer = interaction.fields.getTextInputValue(finalQuestion.id).trim();
    if (!finalAnswer) {
        return interaction.reply({ content: "Please answer the final required question before submitting.", ephemeral: true });
    }

    const application = {
        ...existing,
        answers: { ...existing.answers, [finalQuestion.id]: finalAnswer },
        status: "pending",
        submittedAt: existing.submittedAt || new Date().toISOString(),
        decidedBy: null
    };

    await interaction.deferReply({ ephemeral: true });
    ticketApplications.saveApplication(interaction.guildId, interaction.channelId, application);

    if (application.reviewMessageId) {
        try {
            const previousReview = await interaction.channel.messages.fetch(application.reviewMessageId);
            await previousReview.edit({
                content: "↪️ This application was updated. See the newer submission below.",
                components: []
            });
        } catch (error) {
            console.warn(`⚠️ Alte Bewerbungsnachricht ${application.reviewMessageId} konnte nicht aktualisiert werden:`, error.message);
        }
    }

    const reviewMessage = await interaction.channel.send({
        content: `📨 New application from <@${interaction.user.id}>.`,
        embeds: [ticketApplications.buildApplicationEmbed(application)],
        components: ticketApplications.buildReviewButtons(application),
        allowedMentions: { users: [interaction.user.id] }
    });

    ticketApplications.saveApplication(interaction.guildId, interaction.channelId, {
        ...application,
        reviewMessageId: reviewMessage.id
    });
    return interaction.editReply("✅ Your application was submitted. Staff will review it in this ticket.");
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        try {
            if (interaction.isButton() && interaction.customId.startsWith("server-ticket:")) {
                return await serverTickets.handlePanelButton(interaction);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("server-ticket:")) {
                return await serverTickets.handleTicketModal(interaction);
            }

            if (interaction.isButton() && interaction.customId.startsWith("ticketapp:")) {
                return await handleTicketButton(interaction);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("ticketapp:")) {
                return await handleTicketModal(interaction);
            }

            if (!interaction.isChatInputCommand()) return;

            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const payload = {
                content: "❌ An error occurred while handling this interaction.",
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    }
};
