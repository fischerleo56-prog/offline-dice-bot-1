const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Locks the current channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {

        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🔒 Channel Locked")
            .setDescription(
                `${interaction.channel} has been locked by ${interaction.user}.`
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};