# Shop, payment methods & web dashboard

## Setup
1. Set environment variables (Railway → Variables): `TOKEN`, `CLIENT_ID`, `DASHBOARD_PASSWORD` (min. 8 characters).
   **Never put the token into the GitHub repo.**
2. Open `https://YOUR-DOMAIN/dashboard` and log in with the password.
3. In the dashboard:
   - **Shop & channels:** choose the shop channel (catalog), the private code channel and the staff roles, then Save.
   - **Products:** name, price, description, image URL, emoji and **stock** (empty = unlimited).
   - **Payment methods:** Paysafecard, bank transfer, LTC, PayPal, BTC or your own. Enter your IBAN / LTC address.
   - Then click **Post / update catalog** (or `/shop catalog`).

## Flow in a ticket
- When a ticket is created whose channel name contains the keyword (default `buy-ticket`, e.g. `228-buy-ticket`), the bot sends two select menus: **product** and **payment method**.
- After selecting, it shows the payment instructions. Buttons: **I have paid** (pings staff) and, for payment methods with “send code” (e.g. Paysafe), **Send code**.
- Codes go to the **private code channel** (make it staff-only!). There staff can click **Valid – confirm sale** or **Reject**.
- **Confirm sale** asks the seller how many items were sold; exactly that number is removed from the product's stock, the order is marked as confirmed, the customer is notified and the catalog is updated automatically.
- The same **Confirm sale / Reject** buttons appear in the ticket after the customer clicks **I have paid**.

## Important
- The bot needs access to the ticket channels (View Channel + Send Messages in the Ticket King category).
- The code channel must not be visible to @everyone – only staff and the bot.
- Data lives in `data/` and is lost on every deploy unless you use a volume: Railway → Ctrl+K → Volume, mount path `/data`, variable `DATA_DIR=/data`.
- Commands: `/shop catalog`, `/shop setup`, `/poll`, `/welcomemessage`, `/application`.
