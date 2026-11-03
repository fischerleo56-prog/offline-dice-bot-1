const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const builder = new SlashCommandBuilder()
    .setName("abstimmung")
    .setDescription("Erstellt eine Abstimmung.")
    .addStringOption(option =>
        option
            .setName("frage")
            .setDescription("Die Frage der Abstimmung")
            .setRequired(true)
            .setMaxLength(300)
    )
    .addStringOption(option =>
        option
            .setName("antwort1")
            .setDescription("Antwort 1")
            .setRequired(true)
            .setMaxLength(55)
    )
    .addStringOption(option =>
        option
            .setName("antwort2")
            .setDescription("Antwort 2")
            .setRequired(true)
            .setMaxLength(55)
    );

for (let i = 3; i <= 10; i++) {
    builder.addStringOption(option =>
        option
            .setName(`antwort${i}`)
            .setDescription(`Antwort ${i} (optional)`)
            .setRequired(false)
            .setMaxLength(55)
    );
}

builder
    .addIntegerOption(option =>
        option
            .setName("dauer")
            .setDescription("Dauer in Stunden (Standard: 24, max. 768)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(768)
    )
    .addBooleanOption(option =>
        option
            .setName("mehrfach")
            .setDescription("Mehrfachauswahl erlauben? (Standard: nein)")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

module.exports = {
    data: builder,

    async execute(interaction) {
        const frage = interaction.options.getString("frage");
        const dauer = interaction.options.getInteger("dauer") ?? 24;
        const mehrfach = interaction.options.getBoolean("mehrfach") ?? false;

        const answers = [];
        for (let i = 1; i <= 10; i++) {
            const text = interaction.options.getString(`antwort${i}`);
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
