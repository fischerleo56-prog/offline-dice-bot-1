# Welcome message for Ticket King

1. Put your own `.env` file next to `index.js` and set `TOKEN`. The template is `env.example`.
2. Install dependencies with `npm install`.
3. Start the bot with `node index.js`. On startup it registers the slash commands globally. Alternatively run `node deploy-commands.js` (needs `CLIENT_ID` as well).
4. On your server run `/welcomemessage` and enter the text in `message`. `{user}` mentions the person; `{username}` is replaced by their display name. You can also edit it in the web dashboard (Features tab).

The bot sends the saved text once, as soon as a member writes in a Ticket King ticket for the first time. Global slash commands can take a while to appear. If they are still missing, check the **Use Application Commands** permission in the channel and look at the bot console for the exact Discord error. The setting is stored in `data/ticket-welcome.json`.

For the bot to detect tickets and write in them, its role needs access to the channel: **View Channel**, **Read Message History** and **Send Messages**. The command itself is only available to people with **Manage Server**.

## Top Streamer and VIP applications

In a Ticket King ticket for Top Streamer or VIP the bot automatically posts a shared application form with one button. To detect the ticket type, the **ticket name**, the **ticket category name** or the **Ticket King opening message** must contain “Top Streamer” or “VIP”.

When closing, the bot creates a text transcript and locks the applicant's messages. The team can reopen the ticket with **Reopen ticket**. The bot needs **Send Messages**, **Read Message History**, **Embed Links**, **Attach Files** and (for closing/reopening) **Manage Channels**.

Team commands: `/application panel`, `/application status` and `/application transcript` (require **Manage Channels**).

Application data is stored in `data/ticket-applications.json`. On hosts with ephemeral storage it is lost on deploy – use a volume (see SHOP-GUIDE.md).
