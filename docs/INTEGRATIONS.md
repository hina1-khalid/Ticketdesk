# Optional integrations

All of these are OFF until you fill the matching variables in `backend/.env`. The app works without any of them.

## 1. Email inbox -> tickets (IMAP)
1. Create a support mailbox (e.g. a Gmail account).
2. Gmail: Google Account -> Security -> turn on **2-Step Verification** -> **App passwords** -> create one.
3. Set in `.env`:
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_USER=yoursupport@gmail.com
   IMAP_PASS=<app password>
   IMAP_ORG_SLUG=demo
   ```
4. Restart the backend. Every minute unread mails become tickets; a reply that keeps `[TKT-0001]` in the subject is added as a comment (and reopens a resolved ticket). Auto-replies/bulk mail are skipped.
5. To SEND mails (notifications) also set `SMTP_*` (Gmail: `smtp.gmail.com`, port 587, same app password).

Alternative without IMAP: forward mail with Mailgun/SendGrid inbound-parse to `POST /api/inbound/email` (header `x-inbound-secret`).

## 2. WhatsApp (Twilio)
1. Create a free Twilio account -> **Messaging -> Try it out -> Send a WhatsApp message** (sandbox).
2. From your phone, send the "join <code>" message to the sandbox number.
3. `.env`:
   ```
   TWILIO_SID=ACxxxxxxxx
   TWILIO_TOKEN=xxxxxxxx
   TWILIO_WHATSAPP_FROM=+14155238886
   WHATSAPP_ORG_SLUG=demo
   PUBLIC_URL=https://your-public-api-url      # must be reachable by Twilio, e.g. an ngrok URL while developing
   ```
4. In Twilio sandbox settings set **When a message comes in** to `https://your-public-api-url/api/inbound/whatsapp` (POST).
5. Usage from WhatsApp: any text = new ticket; `status TKT-0001` = status; `TKT-0001 more info...` = comment.
6. Outgoing updates: each user enters their number in **Profile** and ticks "Send me ticket updates on WhatsApp" (events: created, assigned, status change, SLA).
Note: sandbox users must re-join every ~72 h; production needs a Meta-approved WhatsApp Business sender.

## 3. AI service (ML classification + keywords)
```
cd ai-service && pip install -r requirements.txt && uvicorn app:app --port 8000
# backend/.env -> AI_SERVICE_URL=http://localhost:8000
```
Improve it by adding rows to `ai-service/train.csv` (`text,category,priority`) and restarting. Categories must match the ones in Admin -> SLA & settings.

## 4. LLM reply drafts
`ANTHROPIC_API_KEY=...` (optional `LLM_MODEL`). Agents get a "Draft (LLM)" in the AI suggestions box of a ticket.

## 5. Slack / webhooks / Sentry
`SLACK_WEBHOOK_URL` posts new tickets, SLA breaches and spikes to Slack. Custom webhooks: Admin -> API & webhooks. `SENTRY_DSN` enables error tracking.
