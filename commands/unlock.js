const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlocks the current channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {

        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: null
            }
        );

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🔓 Channel Unlocked")
            .setDescription(
                `${interaction.channel} has been unlocked by ${interaction.user}.`
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};