# Shop, Zahlungsarten & Web-Dashboard

## Einrichten
1. Umgebungsvariablen setzen (Render → Environment): `TOKEN`, `CLIENT_ID`, `DASHBOARD_PASSWORD`.
   **Den Token niemals ins GitHub-Repo schreiben.**
2. Bot starten, dann `https://DEINE-URL/dashboard` öffnen und mit dem Passwort einloggen.
3. Im Dashboard:
   - **Shop & Kanäle:** Shop-Kanal (Katalog), privaten Code-Kanal und Team-Rollen wählen, Speichern.
   - **Produkte:** Name, Preis, Beschreibung, Bild-URL, Emoji, „Auf Lager“.
   - **Zahlungsarten:** Paysafecard, Banküberweisung, LTC, PayPal, BTC oder eigene. IBAN / LTC-Adresse eintragen.
   - Danach unter „Shop & Kanäle“ **Katalog posten** klicken (oder `/shop katalog`).

## Ablauf im Ticket
- Entsteht ein Ticket, dessen Kanalname das Stichwort enthält (Standard `buy-ticket`, z. B. `228-buy-ticket`),
  sendet der Bot zwei Auswahlmenüs: **Produkt** und **Zahlungsart**.
- Nach der Auswahl zeigt er die Zahlungsanleitung. Buttons: **Ich habe bezahlt** (pingt das Team) und – bei Zahlungsarten
  mit „Code senden“ (z. B. Paysafe) – **Code senden**.
- Der Code geht in den **privaten Code-Kanal** (nur Team sichtbar machen!). Dort: **Gültig** / **Ungültig** – der Kunde
  wird im Ticket automatisch benachrichtigt.

## Wichtig
- Der Bot braucht Zugriff auf die Ticket-Kanäle (Ticket-King-Kategorie: Bot-Rolle „Kanäle ansehen“ + „Nachrichten senden“ geben).
- Code-Kanal: @everyone darf ihn nicht sehen, nur Team + Bot.
- Daten liegen in `data/` – auf Render Free gehen sie bei jedem Deploy verloren. Persistent Disk + `DATA_DIR` nutzen.
- Befehle: `/shop katalog`, `/shop einstellen`.
