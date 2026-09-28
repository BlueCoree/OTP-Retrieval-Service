# OTP Retrieval Service

This project is a NestJS + TypeScript backend for retrieving the latest OTP email from a Gmail inbox that is already signed in through a portable Chrome profile, extracting the verification code, storing it in PostgreSQL, and exposing the data through REST endpoints.

The service is designed for the challenge described in the repository task and strictly follows the required workflow:
- Uses Chrome Portable rather than the bundled Chromium.
- Reuses an authenticated Gmail session from a browser profile (no automatic login).
- Extracts OTPs from the latest matching email and stores results in a database.
- Exposes read/delete operations via REST.

---

## Implemented Scope
 
**Required:** all four endpoints, PostgreSQL schema via Prisma migrations, duplicate prevention, concurrency control, session-expiry detection, timeouts and browser cleanup.
 
**Bonus items**
 
| Bonus item | Status | Details |
|---|---|---|
| Multiple profiles | Implemented | `POST /otps/fetch` accepts a `profile` parameter. Each profile is a separate Chrome Portable user data directory with its own Gmail account, and each row records its inbox in `inboxAcc`. |
| Second provider (Outlook) | Not implemented | Only Gmail is supported. Provider-specific logic is not yet behind a common interface. |
| Tests | Implement | Unit tests for OTP extraction (extract-otp.spec.ts), unit tests for OtpsService (new OTP stored, duplicate rejected), and e2e tests for all four endpoints. |
| Docker Compose for the database | Implemented | `docker compose up -d` starts PostgreSQL with the credentials from `.env`. |
| Structured logging | Implemented | JSON logs via `nestjs-pino`. OTP codes and email bodies are not logged. |
| `/health` endpoint | Implemented | Built with `@nestjs/terminus`. Checks database connectivity only, not Chrome or the Gmail session. |


---

## Tech Stack
 
- Node.js + TypeScript (strict mode)
- NestJS
- Prisma ORM + PostgreSQL
- `puppeteer-core`
- `async-mutex`
- `nestjs-pino`, `@nestjs/terminus`
- Jest + Supertest
- Docker Compose (database only)


---

## Prerequisites
 
- Node.js **24.9 or newer** (the version this project was developed and tested on; see the testing trade-off below)
- npm
- Docker Desktop (or a local PostgreSQL instance)
- Chrome Portable
- A **throwaway** Gmail account


---

## Chrome Portable Setup

### 1. Install Chrome Portable
Install Chrome Portable using a portable browser package (e.g., PortableApps.com).

Example executable path:

```text
C:\GoogleChromePortable\App\Chrome-bin\chrome.exe
```

### 2. Create a Profile & Login
Simply open the `GoogleChromePortable.exe` launcher. This automatically creates and isolates your profile data inside the `Data\profile` folder. 

Navigate to Gmail (`mail.google.com`) and sign in to your throwaway account manually. **The app does not and will not log in automatically.** Once logged in, close the browser completely.

### 3. Setting Up Multiple Profiles (Bonus Feature)
To evaluate  the multiple profile functionality, you must create a secondary profile directory and authenticate a different Gmail account.

**Create the Secondary Profile:**
Open your terminal and launch the Chrome executable directly, pointing to a new folder inside the `Data` directory (e.g., `profile2`):
```cmd
"C:\GoogleChromePortable\App\Chrome-bin\chrome.exe" --user-data-dir="C:\GooglePortableChrome\Data\profile2"
```

---

## Environment Configuration

Create an `.env` file in the project root:

```env
PORT=3000

# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=otp_seakun
DATABASE_URL="postgresql://postgres:your-db-password@localhost:5432/otp_seakun?schema=public"

# Browser Configuration
CHROME_PORTABLE_PATH="C:\PortableApps\GoogleChromePortable\App\Chrome-bin\chrome.exe"
CHROME_USER_DATA_DIR="C:\ChromeProfiles"
```

> Keep `.env` outside version control and never commit personal Gmail credentials or browser profile data. Adjust the browser configuration to match the path on your local machine.

---

## Database Setup & Execution

The project includes both a Prisma schema definition and a migration file for the `otp_emails` table, so the database structure is versioned and reproducible.

There are two supported ways to run the database:

### Option A: Docker PostgreSQL (recommended for quick setup)

```bash
docker-compose up -d
```

This starts PostgreSQL with the credentials defined in your `.env` file.

### Option B: Local PostgreSQL on your machine

If you prefer to use a local PostgreSQL instance instead of Docker, follow these steps:

1. Create a new database for this project.
2. Update the `DATABASE_URL` in your `.env` file to match your local database credentials:

```env
DATABASE_URL="postgresql://postgres:your-db-password@localhost:5432/otp_seakun?schema=public"
```
3. Ensure PostgreSQL service is running, then apply the schema:

```bash
npm install
npx prisma generate
npx prisma db push
```

> If you use a local PostgreSQL server, make sure the port `5432` is open and the database/user credentials match exactly with `DATABASE_URL`.

### 3. Run the Service

```bash
# Development mode
npm run start:dev

# Run Tests
npm run test
npm run test:e2e
```

The app listens on port 3000 by default.

---

## API Endpoints

### `POST /otps/fetch`
Fetch the latest OTP email from Gmail and store it in the database.

**Request body (optional):**

```json
{
  "sender": "joshuajulyus27@gmail.com",
  "profile": "profile"
}
```

***Response (201):***
```json
{
    "id": 2,
    "senderEmail": "joshuajulyus27@gmail.com",
    "emailSubject": "test otp mutiple acc",
    "emailBody": "Your verification code is 482913. It expires in 5 minutes",
    "emailSentAt": "2026-09-28T05:41:47.589Z",
    "otpCode": "482913",
    "inboxAcc": "profile2",
    "createdAt": "2026-09-28T05:41:48.109Z"
}
```

### `GET /otps`
List stored OTPs in newest-first order, with pagination (`?page=1&limit=10`).

***Response:***
```json
{
    "data": [
        {
            "id": 1,
            "senderEmail": "joshuajulyus27@gmail.com",
            "emailSubject": "test otp",
            "emailBody": "Your verification code is 482913. It expires in 5 minutes.",
            "emailSentAt": "2026-09-28T05:33:44.885Z",
            "otpCode": "482913",
            "inboxAcc": "profile",
            "createdAt": "2026-09-28T05:33:45.890Z"
        },
        {
            "id": 2,
            "senderEmail": "joshuajulyus27@gmail.com",
            "emailSubject": "test otp mutiple acc",
            "emailBody": "Your verification code is 482913. It expires in 5 minutes",
            "emailSentAt": "2026-09-28T05:41:47.589Z",
            "otpCode": "482913",
            "inboxAcc": "profile2",
            "createdAt": "2026-09-28T05:41:48.109Z"
        }
    ],
    "meta": {
        "total": 2,
        "page": 1,
        "limit": 5,
        "totalPages": 1
    }
}
```

### `GET /otps/:id`
Retrieve a specific OTP record by ID. Returns `404` if not found.

***Response:***
```json
{
    "id": 2,
    "senderEmail": "joshuajulyus27@gmail.com",
    "emailSubject": "test otp mutiple acc",
    "emailBody": "Your verification code is 482913. It expires in 5 minutes",
    "emailSentAt": "2026-09-28T05:41:47.589Z",
    "otpCode": "482913",
    "inboxAcc": "profile2",
    "createdAt": "2026-09-28T05:41:48.109Z"
}
```

### `DELETE /otps/:id`
Delete one OTP record by ID. Returns `404` if not found.

***Response:***
```json
{
    "message": "OTP with ID 2 has been deleted."
}
```

### `GET /health`
Returns the application and database health status.

***Response:***
```json
{
    "status": "ok",
    "info": {
        "database": {
            "responseTime": 163,
            "status": "up"
        }
    },
    "error": {},
    "details": {
        "database": {
            "responseTime": 163,
            "status": "up"
        }
    }
}
```

---

## How OTP Extraction Works & Limitations

The service opens Gmail in the configured browser profile and reads the contents of the newest relevant email. It identifies a numeric OTP from the body text using a regex pattern such as:

```ts
/\b\d{4,8}\b/
```

**Limitations:**

- **DOM Sensitivity:** The extraction relies heavily on Gmail's current CSS selectors and DOM structure. If Google updates the Gmail UI, the Puppeteer selectors will break and require maintenance.
- **Session Expiry:** If the Gmail session expires or encounters a security checkpoint, the bot detects it and returns a meaningful error without attempting to re-authenticate.
- **Extraction Rules:** Currently optimized for plain-text numeric codes. OTPs formatted with alphabetical characters, dashes, or complex HTML layouts may require regex adjustments.

---

## Assumptions and Trade-Offs

- **Testing Environment (Jest vs. ESM):** Modern dependencies like `@nestjs/config` and `puppeteer-core` utilize pure ES Modules, conflicting with Jest's legacy CommonJS runtime. Rather than downgrading libraries, a trade-off was made to configure `transformIgnorePatterns` within `jest-e2e.json` to instruct the test runner to explicitly transpile these specific `node_modules`.
- **Deduplication Logic:** The system assumes that an identical `otpCode` from the same sender might still be a valid new request (e.g., a user clicking "Resend OTP"). Therefore, deduplication strictly validates the exact `emailBody` equality rather than just the otp code.
- **Language Locale:** The Puppeteer traversal logic assumes the target Gmail interface is rendered in English.

---

## Example Workflow

1. Install Chrome Portable and sign in manually to the Gmail account.
2. Send a dummy OTP email with content such as: `Your verification code is 482913.`
3. Start the database and app.
4. Call `POST /otps/fetch` with the sender and profile name.
5. Verify the row is inserted into PostgreSQL.
6. Use `GET /otps`, `GET /otps/:id`, and `DELETE /otps/:id` to validate the API lifecycle.

Example fetch request:

```bash
curl --location 'http://localhost:3000/otps/fetch' \
--header 'Content-Type: application/json' \
--data-raw '{
  "sender": "joshuajulyus27@gmail.com",
  "profile": "profile"
}'
```

---

## License

This project is intended for evaluation and educational use within the coding challenge context.
