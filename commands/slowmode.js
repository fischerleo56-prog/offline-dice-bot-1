const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Sets the slowmode for the current channel.")
        .addIntegerOption(option =>
            option
                .setName("seconds")
                .setDescription("Slowmode in seconds (0-21600)")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {

        const seconds = interaction.options.getInteger("seconds");

        await interaction.channel.setRateLimitPerUser(seconds);

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🐢 Slowmode Updated")
            .setDescription(
                seconds === 0
                    ? `Slowmode has been **disabled** in ${interaction.channel}.`
                    : `Slowmode has been set to **${seconds} seconds** in ${interaction.channel}.`
            )
            .setFooter({
                text: `Changed by ${interaction.user.tag}`
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }
};