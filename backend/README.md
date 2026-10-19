# Uddhar Diary - Backend API

The backend server for **Uddhar Diary**, a modern personal finance, expense tracking, and debt management application. Built with **Node.js**, **Express 5**, and **Supabase (PostgreSQL & Auth)**, featuring AI-powered receipt scanning via **Google Gemini** and automated debt reminder emails via **Resend**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database & Storage Setup](#database--storage-setup)
  - [Running the Server](#running-the-server)
  - [Running Tests](#running-tests)
- [Authentication & Security](#authentication--security)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Bills (`/api/bills`)](#bills-apibills)
  - [Debts (`/api/debts`)](#debts-apidebts)
  - [People (`/api/people`)](#people-apipeople)
  - [Expenses & Analytics (`/api/expenses`)](#expenses--analytics-apiexpenses)
  - [Categories (`/api/categories`)](#categories-apicategories)
  - [Profile (`/api/profile`)](#profile-apiprofile)
  - [Account (`/api/account`)](#account-apiaccount)
- [Design Conventions](#design-conventions)

---

## Features

- **AI Receipt Extraction:** Upload receipt images and parse line items, prices, merchant name, category, and date using Google Gemini Vision.
- **Fair Bill Splitting:** Evenly split expenses across participants with integer arithmetic (in *paise*), allocating rounding remainders accurately.
- **Dual Debt Tracking:** Supports both automated bill-split debts and manual one-off loans/debts with custom notes and transaction dates.
- **Settlement Ledger:** Track full or partial debt payments with automatic settlement timestamps.
- **Real-Time Balances:** SQL views aggregate net balances ("they owe you" vs. "you owe them") per contact.
- **Email Reminders:** Send automated payment reminder emails to debtors via the Resend API.
- **Spending Analytics:** Aggregated user expense breakdowns by category and over time (weekly/monthly intervals).
- **Secure Multi-Tenancy:** Supabase Bearer token verification with strict row-level ownership validation across all endpoints.

---

## Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v18+) | JavaScript runtime |
| **Framework** | Express 5 | Web framework with routing and middleware |
| **Database & Auth** | Supabase (PostgreSQL) | Managed Postgres database, Auth, and Storage |
| **AI Vision / OCR** | Google Generative AI | `@google/generative-ai` (Gemini Flash) |
| **Email Service** | Resend | Transactional email delivery API |
| **File Upload** | Multer | In-memory multipart/form-data upload handling |
| **Security** | Express Rate Limit & CORS | Brute-force protection and cross-origin controls |
| **Testing** | Node Test Runner (`node:test`) | Native unit test suite |

---

## Project Structure

```text
backend/
├── .env.example                # Template for environment variables
├── index.js                    # Server entry point and router mounts
├── package.json                # Dependencies and npm scripts
├── sql/
│   ├── create_bill_with_split.sql   # Stored procedure to atomically insert bills, items, and debts
│   ├── uddhar_diary_schema.sql      # Core Supabase database schema
│   └── migration/                   # Schema migrations & database views
│       ├── add_manual_debts.sql
│       ├── add_people_unique_name.sql
│       ├── add_user_share_and_source_to_bills.sql
│       ├── create_bill_user_expense_view.sql
│       ├── create_debts_table.sql
│       ├── create_person_balances_view.sql
│       └── create_profile_on_signup_trigger.sql
└── src/
    ├── lib/
    │   ├── supabaseClient.js    # Service-role Supabase client for DB operations
    │   ├── supabaseVerifier.js  # Anon-key client factory for credential verification
    │   └── validators.js        # Shared UUID, date, and email validation patterns
    ├── middleware/
    │   └── requireAuth.js       # Bearer token verification middleware
    ├── routes/
    │   ├── account.js           # Password change and account security
    │   ├── bills.js             # Image upload, Gemini extraction, and bill creation
    │   ├── categories.js        # Category list endpoint
    │   ├── debts.js             # Balances, history, manual debts, and settlements
    │   ├── expenses.js          # Spending analytics (by-category & over-time)
    │   ├── people.js            # People management and email reminders
    │   └── profile.js           # User profile fetch and update
    └── services/
        ├── billExtraction.js    # Google Gemini AI receipt parsing service
        ├── emailService.js      # Resend email reminder service
        ├── splitCalculator.js   # Deterministic bill-split calculation logic
        └── splitCalculator.test.js # Unit tests for splitCalculator
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- A **Supabase** project
- A **Google Gemini API Key** ([Google AI Studio](https://aistudio.google.com/))
- A **Resend API Key** ([Resend Console](https://resend.com/)) *(optional, required for email reminders)*

### Installation

Navigate to the `backend` directory and install dependencies:

```bash
cd backend
npm install
```

### Environment Variables

Create a `.env` file in the `backend` directory based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following variables:

```env
PORT=3001

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini AI (Receipt Parsing)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview

# Resend (Debt Email Reminders)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

> **Note on Supabase Keys:**
> - `SUPABASE_SERVICE_ROLE_KEY` is used by `supabaseClient.js` to execute queries across tables securely on the server.
> - `SUPABASE_ANON_KEY` is used by `supabaseVerifier.js` to verify a user's current password securely via `signInWithPassword` without granting admin bypass.

### Database & Storage Setup

1. Open your Supabase project's **SQL Editor**.
2. Run `backend/sql/uddhar_diary_schema.sql` to initialize tables (`profiles`, `categories`, `people`, `bills`, `bill_items`, `debts`).
3. Run the migrations in `backend/sql/migration/` (or ensure their views/columns are present):
   - `create_profile_on_signup_trigger.sql` (populates `profiles` when a user registers)
   - `add_people_unique_name.sql` (enforces unique contact names per user)
   - `add_user_share_and_source_to_bills.sql`
   - `add_manual_debts.sql`
   - `create_person_balances_view.sql` (creates `person_balances` view)
   - `create_bill_user_expense_view.sql` (creates `bill_user_expense` view)
4. Run `backend/sql/create_bill_with_split.sql` to create the `create_bill_with_split` stored function.
5. In **Supabase Storage**, create a bucket named `bill-images` (make it publicly readable or configure appropriate storage access policies).

### Running the Server

Start in development mode (with file watching):

```bash
npm run dev
```

Start in production mode:

```bash
npm start
```

The server will listen at `http://localhost:3001`.

### Running Tests

Run the built-in unit test suite (covering bill splitting math, remainder allocation, and boundary checks):

```bash
npm test
```

---

## Authentication & Security

All routes under `/api/*` (except public health check) require a valid Supabase JWT passed in the HTTP `Authorization` header:

```http
Authorization: Bearer <supabase_access_token>
```

- **`requireAuth` Middleware:**
  - Extracts the bearer token.
  - Verifies the cryptographic token using `supabase.auth.getUser(token)`.
  - Injects `req.userId` with the verified UUID.
  - Prevents spoofed `userId` parameters from untrusted request bodies or query params.
- **Tenant Isolation:**
  - Every database operation scopes queries to `user_id = req.userId`.
  - Nested resource routes (e.g. `debts/:debtId`, `people/:personId`) strictly verify ownership before mutation or deletion.
- **Rate Limiting:**
  - Password change endpoint `/api/account/change-password` is rate-limited to 10 failed attempts per 15-minute window per user ID.

---

## API Reference

### Health Check

#### `GET /health`
Returns the status of the server.
- **Auth Required:** No
- **Response `200 OK`:**
  ```json
  { "status": "ok" }
  ```

---

### Bills (`/api/bills`)

All bill routes require authentication.

#### 1. `POST /api/bills/upload-image`
Uploads a receipt image directly to Supabase Storage (`bill-images` bucket).
- **Content-Type:** `multipart/form-data`
- **Body:** `image` (binary file, max 10MB; accepted types: `image/*`)
- **Response `201 Created`:**
  ```json
  {
    "storagePath": "user-uuid/timestamp_filename.jpg"
  }
  ```

#### 2. `POST /api/bills/extract`
Uploads a receipt image and parses it using Google Gemini AI vision.
- **Content-Type:** `multipart/form-data`
- **Body:** `image` (binary file, max 10MB)
- **Response `201 Created`:**
  ```json
  {
    "storagePath": "user-uuid/timestamp_filename.jpg",
    "extracted": {
      "merchantName": "Cafe Coffee Day",
      "items": [
        { "name": "Cappuccino", "price": 180, "quantity": 1 },
        { "name": "Sandwich", "price": 220, "quantity": 1 }
      ],
      "total": 400,
      "category": "Food",
      "billDate": "2026-03-15"
    }
  }
  ```

#### 3. `POST /api/bills`
Persists a bill (either from photo OCR or manual entry), divides the expense, and creates the corresponding debt entries.
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "source": "photo",                 // "photo" or "manual"
    "storagePath": "path/in/bucket.jpg",// Required if source is "photo"
    "merchantName": "Cafe Coffee Day", // Required if "photo", optional if "manual"
    "total": 400.00,                   // Positive number with up to 2 decimal places
    "categoryId": "uuid",              // Optional for "manual" (defaults to "Other")
    "billDate": "2026-03-15",          // YYYY-MM-DD or null
    "items": [                         // Required non-empty array if source is "photo"
      { "name": "Cappuccino", "price": 180, "quantity": 1 },
      { "name": "Sandwich", "price": 220, "quantity": 1 }
    ],
    "paidBy": "you",                   // "you" or a participant's UUID
    "participantIds": ["person-uuid-1", "person-uuid-2"], // UUIDs of other participants
    "alreadyPaid": {                   // Optional upfront payments (only if paidBy="you")
      "person-uuid-1": 50.00
    }
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "id": "bill-uuid",
    "debts": [
      {
        "id": "debt-uuid",
        "billId": "bill-uuid",
        "personId": "person-uuid-1",
        "personName": "Aman",
        "amountPaise": 8333,
        "amountPaidPaise": 0,
        "direction": "they_owe_you",
        "createdAt": "2026-03-15T10:00:00Z",
        "settledAt": null
      }
    ]
  }
  ```

---

### Debts (`/api/debts`)

#### 1. `GET /api/debts/balances`
Retrieves aggregated non-zero net balances for all people associated with the user.
- **Response `200 OK`:**
  ```json
  {
    "balances": [
      {
        "personId": "person-uuid",
        "name": "Rohan",
        "theyOweYouPaise": 50000,
        "youOweThemPaise": 0,
        "netBalancePaise": 50000
      }
    ]
  }
  ```

#### 2. `GET /api/debts/person/:personId`
Fetches complete transaction and debt history for a specific person.
- **Response `200 OK`:**
  ```json
  {
    "personId": "person-uuid",
    "debts": [
      {
        "id": "debt-uuid",
        "billId": "bill-uuid",
        "personId": "person-uuid",
        "direction": "they_owe_you",
        "amountPaise": 15000,
        "amountPaidPaise": 15000,
        "createdAt": "2026-03-10T12:00:00Z",
        "settledAt": "2026-03-12T14:30:00Z",
        "kind": "bill",
        "note": null,
        "incurredOn": null,
        "merchantName": "Grocery Store",
        "billDate": "2026-03-10"
      }
    ]
  }
  ```

#### 3. `POST /api/debts/manual`
Creates a manual debt entry (one-off loan, cash borrowed, or informal expense).
- **Body:**
  ```json
  {
    "personId": "person-uuid",
    "direction": "they_owe_you",        // "they_owe_you" or "you_owe_them"
    "amountPaise": 25000,               // Positive integer (in paise)
    "note": "Dinner bill cash share",   // Optional note (max 500 chars)
    "incurredOn": "2026-03-14"          // Optional date (YYYY-MM-DD)
  }
  ```
- **Response `201 Created`:** Object representing the created debt row.

#### 4. `PATCH /api/debts/:debtId/settle`
Records payment toward a debt. Can be partial or full settlement.
- **Body:**
  ```json
  {
    "amountPaise": 10000               // Optional. If omitted, settles entire remaining balance
  }
  ```
- **Response `200 OK`:** Updated debt object with new `amountPaidPaise` and `settledAt`.

#### 5. `PATCH /api/debts/:debtId`
Edits a manual debt entry (cannot edit bill-based debts or debts with payments recorded).
- **Body:** (at least one field required)
  ```json
  {
    "amountPaise": 30000,
    "direction": "they_owe_you",
    "note": "Updated note",
    "incurredOn": "2026-03-15"
  }
  ```
- **Response `200 OK`:** Updated debt object.

#### 6. `DELETE /api/debts/:debtId`
Deletes an unpaid manual debt entry.
- **Response `200 OK`:**
  ```json
  { "id": "debt-uuid" }
  ```

---

### People (`/api/people`)

#### 1. `GET /api/people`
Returns all contacts added by the authenticated user.
- **Response `200 OK`:**
  ```json
  [
    { "id": "person-uuid-1", "name": "Rahul", "email": "rahul@example.com" },
    { "id": "person-uuid-2", "name": "Priya", "email": null }
  ]
  ```

#### 2. `POST /api/people`
Adds a new contact. Contact names must be unique per user (case-insensitive).
- **Body:**
  ```json
  {
    "name": "Amit Sharma",
    "email": "amit@example.com"        // Optional (can be omitted or null)
  }
  ```
- **Response `201 Created`:** Created person object.
- **Response `409 Conflict`:** If a person with this name already exists for the user.

#### 3. `PATCH /api/people/:personId`
Updates a person's name and/or email address.
- **Body:**
  ```json
  {
    "name": "Amit S.",
    "email": "newemail@example.com"    // String or null
  }
  ```
- **Response `200 OK`:** Updated person object.

#### 4. `POST /api/people/:personId/remind`
Sends an automated payment reminder email via Resend to the contact.
- **Requirements:** Person must have an email address and a positive outstanding balance (`they_owe_you_paise > 0`).
- **Response `200 OK`:**
  ```json
  { "message": "Reminder sent successfully" }
  ```

---

### Expenses & Analytics (`/api/expenses`)

#### 1. `GET /api/expenses/by-category`
Aggregates user's personal expense share across categories for a given week or month.
- **Query Parameters:**
  - `granularity`: `week` or `month` (required)
  - `date`: `YYYY-MM-DD` (optional, defaults to current date)
- **Response `200 OK`:**
  ```json
  [
    { "categoryId": "uuid-1", "categoryName": "Food", "totalPaise": 125000 },
    { "categoryId": "uuid-2", "categoryName": "Travel", "totalPaise": 45000 }
  ]
  ```

#### 2. `GET /api/expenses/over-time`
Returns time-series buckets of user spending for charts. Missing intervals are automatically zero-filled.
- **Query Parameters:**
  - `granularity`: `week` or `month` (required)
  - `from`: `YYYY-MM-DD` (optional, defaults to 12 weeks or 12 months ago)
  - `to`: `YYYY-MM-DD` (optional, defaults to today)
- **Response `200 OK`:**
  ```json
  [
    { "periodStart": "2026-01-04", "totalPaise": 82000 },
    { "periodStart": "2026-01-11", "totalPaise": 0 },
    { "periodStart": "2026-01-18", "totalPaise": 43500 }
  ]
  ```

---

### Categories (`/api/categories`)

#### `GET /api/categories`
Fetches system categories (Food, Travel, Clothing, Groceries, Entertainment, Utilities, Other).
- **Response `200 OK`:**
  ```json
  [
    { "id": "uuid-1", "name": "Food" },
    { "id": "uuid-2", "name": "Travel" }
  ]
  ```

---

### Profile (`/api/profile`)

#### 1. `GET /api/profile`
Fetches the profile for the authenticated user.
- **Response `200 OK`:**
  ```json
  {
    "profile": {
      "id": "user-uuid",
      "fullName": "Abhinav Singh",
      "email": "user@example.com"
    }
  }
  ```

#### 2. `PATCH /api/profile`
Updates the authenticated user's full name.
- **Body:**
  ```json
  {
    "fullName": "Abhinav Singh"
  }
  ```
- **Response `200 OK`:** Updated profile object.

---

### Account (`/api/account`)

#### `POST /api/account/change-password`
Changes the user's password securely.
- **Security:**
  - Rate-limited to 10 failed attempts per 15 minutes.
  - Re-verifies `currentPassword` against Supabase Auth before applying `newPassword`.
- **Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword456!"
  }
  ```
- **Response `200 OK`:**
  ```json
  { "success": true }
  ```

---

## Design Conventions

### 1. Integer Arithmetic in Paise
To avoid floating-point inaccuracies common in monetary calculations (e.g., `0.1 + 0.2 !== 0.3`):
- All amounts stored in database debts and calculated internally are represented in **paise** ($1\text{ INR} = 100\text{ paise}$).
- When receiving rupee amounts from front-end inputs or OCR, values are converted to paise:
  $$\text{amountPaise} = \text{Math.round}(\text{amountINR} \times 100)$$

### 2. Fair Split & Remainder Distribution
When dividing an amount amongst $N$ participants:
- `baseShare = Math.floor(totalPaise / N)`
- `remainder = totalPaise % N`
- The bill payer receives the remainder so that:
  $$\text{userSharePaise} + \sum \text{debtPaise} = \text{totalPaise}$$
  guaranteeing exact ledger balancing to the last paisa.

### 3. Error Handling Standards
- **`400 Bad Request`:** Client validation errors (missing parameters, malformed JSON, invalid IDs).
- **`401 Unauthorized`:** Missing, malformed, or expired Supabase Bearer token.
- **`404 Not Found`:** Resource does not exist or does not belong to the authenticated user.
- **`409 Conflict`:** Domain rule violation (e.g., duplicate contact name, editing an already partially-settled debt).
- **`413 Payload Too Large`:** Receipt image exceeds 10MB limit.
- **`415 Unsupported Media Type`:** Uploaded file is not an image.
- **`429 Too Many Requests`:** Rate limit exceeded (e.g., repeated failed password attempts).
- **`502 Bad Gateway`:** Upstream provider failure (e.g., Supabase RPC error, Resend delivery issue).
