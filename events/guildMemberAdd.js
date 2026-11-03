const {
    Events,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    name: Events.GuildMemberAdd,

    async execute(member) {

        // Member-Rolle vergeben
        const memberRole = member.guild.roles.cache.find(
            role => role.name === "👤 Member"
        );

        if (memberRole) {
            await member.roles.add(memberRole);
        }

        // Welcome-Kanal finden
        const welcomeChannel = member.guild.channels.cache.find(
            channel => channel.name === "👋│welcome"
        );

        if (!welcomeChannel) return;

        const embed = new EmbedBuilder()
            .setColor("#ff69b4")
            .setTitle("🎉 Welcome!")
            .setDescription(
                `Welcome ${member} to **${member.guild.name}**!\n\nHave fun and enjoy your stay! 💖`
            )
            .addFields(
                {
                    name: "👥 Members",
                    value: `${member.guild.memberCount}`,
                    inline: true
                },
                {
                    name: "📅 Account Created",
                    value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`,
                    inline: true
                }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: member.guild.name
            })
            .setTimestamp();

        await welcomeChannel.send({
            content: `👋 Welcome ${member}!`,
            embeds: [embed]
        });

    }
};