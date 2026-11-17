const fs = require("fs");
const path = require("path");

const dataDirectory = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const file = path.join(dataDirectory, "bot-settings.json");
const defaults = { activityText: "Brainrot Community", activityType: 3 };

function get() {
    try {
        return { ...defaults, ...JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch (error) {
        return { ...defaults };
    }
}

function set(input) {
    const next = {
        activityText: String(input.activityText ?? defaults.activityText).trim().slice(0, 100) || defaults.activityText,
        // 0 Playing, 2 Listening, 3 Watching, 5 Competing
        activityType: [0, 2, 3, 5].includes(Number(input.activityType)) ? Number(input.activityType) : 3
    };
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
    return next;
}

function apply(client) {
    const settings = get();
    client.user?.setActivity(settings.activityText, { type: settings.activityType });
    return settings;
}

module.exports = { get, set, apply };
