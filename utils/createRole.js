async function createRole(guild, name, color = "Default") {
    let role = guild.roles.cache.find(r => r.name === name);

    if (!role) {
        role = await guild.roles.create({
            name,
            color,
            reason: "Created by Brainrot Bot Setup"
        });

        console.log(`✅ Created role: ${name}`);
    }

    return role;
}

module.exports = createRole;