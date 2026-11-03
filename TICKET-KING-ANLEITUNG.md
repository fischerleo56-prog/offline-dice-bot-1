# Willkommensnachricht für Ticket King

1. Lege deine eigene `.env`-Datei neben `index.js` ab und trage `TOKEN` ein. Die Vorlage steht in `.env.example`.
2. Installiere die Abhängigkeiten mit `npm install`.
3. Starte den Bot mit `node index.js`. Beim Start registriert er die Slash-Befehle global. Alternativ kannst du sie mit `node deploy-commands.js` registrieren; dafür muss zusätzlich `CLIENT_ID` in `.env` stehen.
4. Führe auf deinem Server `/willkommensnachricht` aus und trage bei `nachricht` den gewünschten Text ein, zum Beispiel: `Na ja, aber das weißt du, oder?`. `{user}` erwähnt die Person; `{username}` wird durch ihren Anzeigenamen ersetzt.

Der Bot sendet den gespeicherten Text einmal, sobald ein Mitglied in einem Ticket-King-Ticket zum ersten Mal schreibt. Globale Slash-Befehle können etwas brauchen, bis sie in Discord erscheinen. Falls sie weiterhin fehlen, prüfe im betroffenen Kanal die Berechtigung **Anwendungsbefehle verwenden** und kontrolliere die Bot-Konsole auf die genaue Discord-Fehlermeldung. Die Einstellung wird in `data/ticket-welcome.json` gespeichert.

Discord erlaubt Anwendungsbefehle nur, wenn die App mit dem Scope `applications.commands` installiert wurde; der normale OAuth2-Scope `bot` schließt diesen mit ein.

Damit der Bot Tickets erkennen und darin schreiben kann, muss seine Rolle in Ticket-King-Tickets Zugriff auf den Kanal oder Thread haben: **Kanal ansehen**, **Nachrichtenverlauf anzeigen** und **Nachrichten senden**. Der Befehl selbst ist nur für Personen mit **Server verwalten** verfügbar.

## Top-Streamer- und VIP-Bewerbungen

In einem Ticket-King-Ticket für Top-Streamer oder VIP veröffentlicht der Bot automatisch ein gemeinsames Bewerbungsfeld mit genau einem Button. Damit er den Tickettyp erkennt, muss im **Ticketnamen**, im **Namen der Ticket-Kategorie** oder in der **Eröffnungsnachricht von Ticket King** „Top Streamer“ beziehungsweise „VIP“ stehen.

Die gemeinsame Bewerbung gilt für Top Streamer und VIP. Sie fragt verpflichtend: “How often have you gone live on TikTok with Offline Dice?”, “Why do you want to become a Top Streamer or VIP?”, “What do you want to achieve as a Top Streamer or VIP?”, “What is the TikTok username you use to go live?”, “How many viewers do you have during a typical stream?” und “Do you have proof that you’re trustworthy?”. Wegen Discords Fünf-Felder-Limit wird die letzte Frage direkt nach den ersten fünf in einem zweiten Formularschritt beantwortet. Danach sieht das Team alle Antworten im Ticket und kann den Antrag übernehmen, annehmen, ablehnen oder weitere Informationen anfordern.

Beim Schließen erstellt der Bot einen Text-Transkript-Anhang und sperrt die Nachrichten der antragstellenden Person im Ticket. Über **Reopen ticket** kann das Team das Ticket wieder öffnen. Für den Bewerbungsablauf braucht der Bot in den betroffenen Tickets **Nachrichten senden**, **Nachrichtenverlauf anzeigen**, **Links einbetten** und **Dateien anhängen**. Zum Schließen und Wiederöffnen benötigt er zusätzlich **Kanäle verwalten**.

Die Bewerbungsdaten werden während der Laufzeit des Tickets in `data/ticket-applications.json` gespeichert und beim Löschen des Discord-Kanals aus der Datei entfernt. Bei flüchtigem Host-Speicher gehen sie bei einem Deployment verloren; bei dauerhaftem Speicher bleiben sie erhalten.

Für das Team gibt es zusätzlich `/bewerbung panel`, `/bewerbung status` und `/bewerbung transkript`. Damit kann ein Bewerbungsfeld bei Bedarf manuell gepostet, der aktuelle Antrag eingesehen und ein Text-Transkript exportiert werden. Diese Slash-Befehle benötigen **Kanäle verwalten**.

Wenn der Bot auf einem Host mit flüchtigem Dateispeicher läuft, kann dessen gespeicherte Einstellung bei einem neuen Deployment verloren gehen. In diesem Fall muss der Host einen dauerhaften Speicher für `data/ticket-welcome.json` bereitstellen.
