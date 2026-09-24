# Coding Test: OTP Retrieval Service (Node.js + TypeScript + Puppeteer)

## Background
We manage many email inboxes and need to automatically retrieve one-time passwords (OTPs) from them. In this test, you'll build a small backend service that uses Puppeteer to control a **Chrome Portable** instance that is already logged in to Gmail. The service finds the latest OTP email, extracts the code, stores it in a database, and exposes it through a REST API.

**Estimated effort:** 4–6 hours. **Deadline:** 5 days after you receive this test.

## Mandatory requirements
1. **Language:** Node.js with TypeScript (strict mode on).
2. **Browser:** You must use **Chrome Portable** (e.g. from PortableApps.com), not an installed Chrome app or Puppeteer's bundled Chromium. Use `puppeteer-core` or `puppeteer` with an explicit `executablePath` pointing to the portable binary.
3. **Session:** Log in to Gmail once, manually, inside Chrome Portable. The bot reuses that session through the portable profile's user data directory. **The bot must not perform a login.**
4. **Database:** PostgreSQL or MySQL, your choice. Include migrations or an SQL schema file.
5. **Test data:** Use a **throwaway Gmail account you create for this test**. Send yourself dummy emails that contain an OTP in the body, for example: `Your verification code is 482913. It expires in 5 minutes.`
6. **Configuration:** The Chrome Portable path, the profile directory, and the DB credentials come from environment variables (`.env.example` required). Never hardcode them.

## Database table
Create an `otp_emails` table (or similar) with at least these columns:

| Column | Type (suggested) | Notes |
|---|---|---|
| `id` | serial / auto-increment PK | |
| `sender_email` | varchar | Address of the sender |
| `email_subject` | varchar | |
| `email_body` | text | Plain-text body |
| `email_sent_at` | timestamp | When the email was sent, taken from Gmail, not the insert time |
| `otp_code` | varchar | Extracted code |
| `created_at` | timestamp | Row insert time |

You may add columns or indexes if you can justify them. For example, a unique constraint to prevent the same email from being stored twice.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/otps/fetch` | Launch or attach to Chrome Portable with Puppeteer, open Gmail, find the **latest** OTP email, open it, extract the OTP, insert it into the DB, and return the created row. |
| `GET` | `/otps` | List stored OTPs, newest first. Must support pagination (`?page=&limit=`). |
| `GET` | `/otps/:id` | Get one OTP by id. Return `404` if it doesn't exist. |
| `DELETE` | `/otps/:id` | Delete one OTP by id. Return `404` if it doesn't exist. |

**`POST /otps/fetch`:** the request body is optional. At minimum, support filtering by sender:

```json
{ "sender": "noreply@example.com" }
```

Example success response (`201`):

```json
{
  "id": 12,
  "sender_email": "noreply@example.com",
  "email_subject": "Your login code",
  "email_body": "Your verification code is 482913. It expires in 5 minutes.",
  "email_sent_at": "2026-09-24T07:10:22.000Z",
  "otp_code": "482913",
  "created_at": "2026-09-24T07:10:30.512Z"
}
```

### Cases you must handle
- No matching email is found. Return a clear error status and message; don't crash.
- An email is found but contains no recognizable OTP.
- The same email is fetched twice. Don't create a duplicate row. Return the existing row or a clear response.
- Two `fetch` requests arrive at the same time. Only one should drive the browser profile at a time.
- The Gmail session has expired or you land on a login page. Detect it and return a meaningful error. Do **not** try to log in.
- Timeouts. The browser must not hang forever, and the browser or page must be cleaned up properly.

## Deliverables
1. A Git repository (GitHub/GitLab link) with clean commit history.
2. `README.md` covering:
   - Setup steps, including how to install Chrome Portable and do the one-time Gmail login
   - How to run migrations and start the service
   - How OTP extraction works and what its limitations are
   - Any assumptions or trade-offs you made
3. `.env.example` and the schema or migrations.
4. **A 3–5 minute screen recording** showing: sending a dummy OTP email → calling `POST /otps/fetch` → the row appearing in the DB → the list, get, and delete endpoints working.
5. Do **not** commit your Chrome profile folder, cookies, or credentials.

## Bonus (optional, not required)
- **Multiple profiles:** support several Chrome Portable profiles, one Gmail account each. `POST /otps/fetch` accepts a `profile` or `account` parameter, and each row records which inbox it came from.
- **A second provider:** add Outlook alongside Gmail, behind a common interface, so providers can be added without touching the API layer.
- Unit tests for OTP extraction; integration tests for the endpoints.
- Docker Compose for the database.
- Structured logging and a `/health` endpoint.

## How we evaluate

| Area | Weight | What we look at |
|---|---|---|
| Puppeteer & browser handling | 30% | Correct Chrome Portable usage, session reuse, robust selectors and waits, cleanup, no hardcoded sleeps |
| Backend & API design | 25% | Clean routing and validation, correct status codes, error handling, pagination |
| Database | 15% | Schema, migrations, duplicate prevention, queries |
| Code quality | 20% | TypeScript types, structure and separation of concerns, readability, config handling |
| Docs & communication | 10% | README clarity, honest notes on limitations and trade-offs |
