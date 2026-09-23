# Cash & UPI Payment Manager — Project Brief

A single reference document pulling together every decision made so far. Use this as the master prompt/spec when building, or when briefing a developer/AI assistant on the project.

---

## 1. Core Idea

A personal finance app that tracks **two types of money movement** for **multiple users**, each with their own private login:

1. **Cash transactions** — entered manually only (no digital trail exists to automate this)
2. **UPI transactions** — captured automatically in real time from bank/UPI notifications on the user's phone

Each user logs in separately and only sees their own transactions and dashboard.

---

## 2. Tech Stack

**Current stack: MERN**
- **Frontend:** React 19 + Vite, Recharts (charts), Lucide React (icons), Axios, plain CSS
- **Backend:** Node.js + Express 5
- **Database:** MongoDB + Mongoose (being migrated — see Section 3)
- **Auth:** JWT (jsonwebtoken) + Bcryptjs, with OTP email verification via Nodemailer
- **Mobile capture layer:** Native Android app (Kotlin) — required because notification/SMS reading is an OS-level capability only available inside an installed Android app, not a website or backend

**Planned migration: MERN → PERN**
- Replace MongoDB/Mongoose with **PostgreSQL** (via **Prisma** or Sequelize)
- React, Express, Node, JWT, Bcryptjs, Nodemailer all stay unchanged
- Reasoning: financial/transactional data benefits from PostgreSQL's strict schema, ACID guarantees, accurate `DECIMAL` types for money, and native `SUM()`/`GROUP BY` reporting — this is the standard approach used by banks, PayPal, and similar transaction-heavy systems
- Migrate now, while the project is still small (few models: User, OTP, and the not-yet-built Transaction table) — cheaper to switch now than after more features are built on Mongo-specific patterns
- Suggested hosting: Supabase or Neon (both have a free PostgreSQL tier)

---

## 3. Database Schema (PostgreSQL)

### `users`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL / UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | via Bcryptjs |
| linked_banks | TEXT[] or join table | banks the user has selected (multi-bank support) |
| created_at | TIMESTAMP | |

### `otp` (existing, keep as-is conceptually)
- Tied to `user_id`, used for email verification / password reset

### `transactions`
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    source TEXT CHECK(source IN ('cash', 'upi')) NOT NULL,
    type TEXT CHECK(type IN ('credit', 'debit')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    counterparty TEXT,           -- sender/receiver name OR UPI VPA
    counterparty_type TEXT,      -- 'name' or 'vpa'
    ref_no TEXT,
    txn_date TIMESTAMP,          -- nullable; not every bank message includes this
    balance DECIMAL(10,2),
    bank TEXT,                   -- e.g. 'TMB', 'SBI', 'HDFC'
    account_no TEXT,             -- masked, e.g. XXXX0086 — distinguishes multiple accounts in same bank
    entry_mode TEXT CHECK(entry_mode IN ('manual', 'auto')) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

Key relationship: **one user → many transactions** (standard relational one-to-many, enforced via `user_id` foreign key).

---

## 4. UPI Auto-Capture: How It Works

Since there is no public API to pull transactions directly from a bank or UPI app (for security reasons), the only real-time option is reading data that already reaches the phone.

### Chosen method: Android Notification Listener
- Uses Android's built-in `NotificationListenerService` — free, no third-party cost
- Requires the user to manually grant **Notification Access** in phone settings (Android does not allow a simple pop-up "Allow" for this — it's a deliberate extra step for a sensitive permission)
- Once granted, the app receives every notification posted on the device and filters for ones from recognized bank/UPI senders
- SMS reading was considered but not used as the primary method (Play Store policy is stricter on `READ_SMS`, and it doesn't work on iOS at all) — may be added later as a backup/cross-check

### End-to-end data flow
```
Bank/UPI app sends notification
      ↓
Android app: NotificationListenerService captures it
      ↓
Android app: parses the text (regex/pattern matching) → amount, type, ref no, date, bank, counterparty
      ↓
Android app: sends parsed JSON to Express backend via API call (with JWT token identifying the user)
      ↓
Express backend: verifies JWT, attaches user_id
      ↓
PostgreSQL: transaction row inserted
      ↓
React dashboard: fetches and displays updated transactions
```

Important clarification for UI copy: the app does **not** connect to the bank account or UPI app directly (no OAuth, no bank login). It only reads notification text that already appears on the phone. UI wording should say this plainly to build user trust.

---

## 5. Handling Multiple Banks & Sender ID Variations

**Problem observed:** the same bank sends messages from multiple sender ID prefixes depending on message category, following India's DLT/TRAI format `XX-ENTITYNAME-S` (e.g., `VM-TMBANK-S`, `AX-TMBANK-S`, `AD-TMBANK-S`, `JM-TMBANK-S`, `VA-TMBANK-S` are all Tamilnad Mercantile Bank, just different routes). Message wording also differs between credit and debit messages from the *same* bank.

**Solution: a bank-pattern library**
- Match sender IDs by checking if they **contain** the bank's core name (`"TMBANK"`, `"TMB"`) rather than exact string match
- Build one entry per bank: sender-ID keywords + separate regex patterns for credit and debit message formats
- Only add a bank once a real sample message from that bank has been collected (can't guess exact wording)
- Start with a handful of major banks (SBI, HDFC, ICICI, Axis, TMB) and expand as users link new banks
- Use a **generic fallback parser** for unmapped banks — searches loosely for "credited"/"debited", "Rs." + number, "Ref No" — less accurate but better than nothing
- Filter out non-transaction messages from the same sender category (e.g., SIP/mutual fund purchase alerts, promotional messages) — only bank/UPI credit-debit alerts should become transactions

---

## 6. Multi-Bank Support Per User

- Fully supported without any core architecture change — the notification listener already receives all notifications; multi-bank just means matching against more patterns
- UI: multi-select (checkboxes) during setup, letting a user tick every bank they hold an account with
- Stored as a list against the user (`linked_banks`)
- Each transaction already carries `bank` and `account_no` fields, so multiple banks — and multiple accounts within the same bank — are distinguishable
- Dashboard can show totals per bank, combined totals across all linked banks, and filter by bank

---

## 7. UI Flow for Connecting SMS/Notification Access

1. **After login/signup** — explain screen: "Connect your bank/UPI notifications to automatically track transactions," with honest copy about what is and isn't being accessed
2. **"Enable Auto-Tracking" button** — triggers Android's notification access settings screen directly
3. **Confirmation/status indicator** — shows whether access is currently granted or not, with a re-enable path if revoked later
4. **Bank selection (multi-select)** — user ticks every bank/UPI provider they use; used to prioritize which parsing patterns apply to them
5. **Ongoing settings page** — shows connection status and linked banks, lets the user manage them later

---

## 8. Open / Next Steps

- [ ] Finalize PostgreSQL schema and complete MERN → PERN migration (Prisma setup, rewrite Mongoose queries, migrate existing User/OTP data if any exists)
- [ ] Build the Android notification listener service + permission request flow
- [ ] Build the regex/pattern parser for TMB (already have sample messages) and expand to 3–5 major banks
- [ ] Build the API endpoint(s) for receiving parsed transactions (JWT-protected)
- [ ] Design multi-bank selection UI and linked-banks storage
- [ ] Build dashboard views: combined totals, per-bank breakdown, cash vs UPI comparison, monthly summaries
- [ ] Decide on SMS-reading as a v2 backup to notification listening, if gaps are found

---

*This document reflects the state of the project plan as discussed; update it as decisions evolve.*
