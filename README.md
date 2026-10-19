# TicketDesk — MERN Ticket Management System

React (Vite + Tailwind) · Node/Express · MongoDB (Mongoose) · Socket.io · optional Redis/BullMQ · optional Python AI service.

## Run locally (3 steps)
Requirements: Node 18+, MongoDB running locally (or Docker).

```bash
# 1) backend
cd backend && cp .env.example .env && npm install
npm run seed          # demo data (DROPS the db), org code: demo
npm run dev           # http://localhost:5000  (API docs: /api/docs)

# 2) frontend (new terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173

# 3) optional AI service (better classification; rules work without it)
cd ai-service && pip install -r requirements.txt && uvicorn app:app --port 8000
#   then set AI_SERVICE_URL=http://localhost:8000 in backend/.env
```
Or everything with Docker: `docker compose up --build` -> http://localhost:8080 (then `docker compose exec backend node src/seed.js`).

Demo logins (password `Password123!`): admin@demo.com, agent@demo.com, senior@demo.com, manager@demo.com, viewer@demo.com, user@demo.com

## Feature checklist
**Core**: register/login (JWT+bcrypt), roles Admin/Manager/Viewer/Agent/User with a permission matrix · tickets with category, priority, attachments (Multer) · status flow Open→In Progress→Resolved→Closed · assignment · comments · tags · search & filters · dashboard charts · CSAT feedback · full history.
**Enhancements**: SLA timer + red overdue marks · business hours/holidays aware SLA · email notifications (Nodemailer) · auto-assignment (least loaded, department aware) · audit trail · CSV/PDF export · dark mode · responsive/PWA · pagination & sorting · Jest tests + GitHub Actions CI.
**AI / data**: category+priority suggestion (rules incl. Roman Urdu, or ML service) · sentiment (angry tickets rise in "Smart" sort) · duplicate detection · suggested replies (past solutions, canned, optional LLM) · resolution-time prediction · weekly volume forecast · spike/anomaly alerts · auto-tags · chatbot · Power BI feed (`docs/POWERBI.md`).
**Users**: knowledge base + KB suggestions while creating a ticket · public tracking page `/track` · reopen · email-to-ticket (IMAP inbox polling + webhook; replies with `[TKT-0001]` in the subject are added to that ticket) · WhatsApp tickets & status (`status TKT-0001`) via Twilio · English/Urdu UI (RTL).
**Agents**: canned responses · internal notes · @mentions · Kanban drag&drop · merge & link · escalation to senior agent on SLA miss · time tracking · bulk actions · saved views · keyboard shortcuts (`?`).
**Admin**: agent performance, CSAT · departments/teams routing · automation rules (created/status/idle triggers) · permission panel · custom fields · API keys + webhooks (HMAC) · CSV import · weekly summary email · audit log.
**Security/quality**: 2FA (TOTP) · Helmet · rate limiting · input whitelisting · Swagger · Docker · soft delete + archive (+auto-archive) · multi-organization · Redis cache + BullMQ (when `REDIS_URL` set) · Sentry (when `SENTRY_DSN` set) · winston logging.

## Setup guides for optional integrations
See `docs/INTEGRATIONS.md` (IMAP inbox, WhatsApp/Twilio, SMTP, AI service, LLM) and `docs/POWERBI.md`.

## Known limits (be honest in interviews)
* Forecast = Holt linear exponential smoothing; ETA = median/80th percentile of similar tickets; anomaly = z-score. These are statistical methods, and need a few hundred real tickets to be meaningful. The ML classifier is trained on a small bundled CSV (`ai-service/train.csv`) — add your own rows to improve it.
* WhatsApp: Twilio sandbox works for demos; a real business number needs Meta approval. Not tested against live Twilio/IMAP servers here.
* LLM replies need `ANTHROPIC_API_KEY`; without it only past-solution/canned suggestions appear.
* Urdu covers all screens except the Admin area (staff-only). Please proofread `frontend/src/i18n.js` — the Urdu text was machine-written.
* Power BI `.pbix` is not included (see docs/POWERBI.md).
* API integration tests (`tests/api.test.js`) need internet once to download an in-memory MongoDB binary.

## Folder map
`backend/src/{models.js, routes/, services/, middleware/}` · `frontend/src/{pages/, components/, context/}` · `ai-service/` · `docs/` · `.github/workflows/ci.yml`
