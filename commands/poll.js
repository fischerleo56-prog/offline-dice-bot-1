const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const builder = new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Creates a poll.")
    .addStringOption(option =>
        option
            .setName("question")
            .setDescription("The poll question")
            .setRequired(true)
            .setMaxLength(300)
    )
    .addStringOption(option =>
        option
            .setName("answer1")
            .setDescription("Answer 1")
            .setRequired(true)
            .setMaxLength(55)
    )
    .addStringOption(option =>
        option
            .setName("answer2")
            .setDescription("Answer 2")
            .setRequired(true)
            .setMaxLength(55)
    );

for (let i = 3; i <= 10; i++) {
    builder.addStringOption(option =>
        option
            .setName(`answer${i}`)
            .setDescription(`Answer ${i} (optional)`)
            .setRequired(false)
            .setMaxLength(55)
    );
}

builder
    .addIntegerOption(option =>
        option
            .setName("duration")
            .setDescription("Duration in hours (default: 24, max. 768)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(768)
    )
    .addBooleanOption(option =>
        option
            .setName("multiple")
            .setDescription("Allow multiple answers? (default: no)")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

module.exports = {
    data: builder,

    async execute(interaction) {
        const frage = interaction.options.getString("question");
        const dauer = interaction.options.getInteger("duration") ?? 24;
        const mehrfach = interaction.options.getBoolean("multiple") ?? false;

        const answers = [];
        for (let i = 1; i <= 10; i++) {
            const text = interaction.options.getString(`answer${i}`);
            if (text) answers.push({ text });
        }

        await interaction.reply({
            poll: {
                question: { text: frage },
                answers,
                duration: dauer,
                allowMultiselect: mehrfach
            }
        });
    }
};
