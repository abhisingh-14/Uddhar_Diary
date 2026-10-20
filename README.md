# UddharDiary

UddharDiary is a comprehensive personal finance and debt tracking application. "Uddhar" is a Hindi word meaning "borrowing" or "debt". The app helps you keep track of your daily expenses, manage debts with friends, and split bills effortlessly with the power of AI.

## Features

- **Authentication & Security:** Secure user sign-up, login, and password recovery powered by Supabase Auth with rate-limited credential updates.
- **Expense Tracking & Categorization:** Monitor your daily expenses, categorize them, and visualize your spending habits with interactive category breakdown and trend charts.
- **Uddhar (Debt) Diary:** Keep a detailed dual ledger of people who owe you money (*"They Owe You"*) and whom you owe (*"You Owe Them"*). View individual profiles to see transaction history.
- **Manual Loan Management:** Manually log and manage loans or dues with custom notes, transaction dates, and settle amounts with full or partial payments.
- **AI-Powered Bill Splitting:** Upload receipt images and let Google Gemini AI automatically extract items, prices, date, and category. Split bills evenly among friends with exact integer paisa arithmetic and remainder allocation.
- **Email Reminders:** Send polite, automated email payment reminders to friends who owe you money, powered by Resend.
- **Responsive & Optimized UI:** A beautiful and modern user interface built with React 19 and Tailwind CSS v4, featuring a collapsible sidebar for desktop and a bottom tab bar for seamless navigation on mobile devices.

## Tech Stack

**Frontend:**
- React 19 & Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router v7
- Recharts (for data visualization)
- Lucide React (for icons)
- Supabase Client (`@supabase/supabase-js`)

**Backend:**
- Node.js & Express 5
- Supabase (PostgreSQL Database, Auth, Storage)
- Google Generative AI (`@google/generative-ai` / Gemini Flash)
- Resend (Email service)
- Multer (Multipart image uploads)
- Express Rate Limit (Brute-force protection)
- Node Test Runner (`node:test`)

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A Supabase project
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))
- A Resend API key ([Resend Console](https://resend.com/)) *(optional, for email reminders)*

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd UddharDiary
```

### 2. Database & Supabase Setup

Before running the application, configure your Supabase project:

1. Open your Supabase project's **SQL Editor**.
2. Run `backend/sql/uddhar_diary_schema.sql` to initialize tables (`profiles`, `categories`, `people`, `bills`, `bill_items`, `debts`).
3. Run the SQL scripts in `backend/sql/migration/` (including `create_profile_on_signup_trigger.sql`, `create_person_balances_view.sql`, `create_bill_user_expense_view.sql`, etc.).
4. Run `backend/sql/create_bill_with_split.sql` to create the stored procedure.
5. In **Supabase Storage**, create a new bucket named `bill-images` (make it publicly readable or configure storage policies).

### 3. Setup the Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory (you can copy from `.env.example`):

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Start the backend server:

```bash
npm run dev     # Starts with watch mode
# or: npm start
```
The server will run on `http://localhost:3001`.

To run the backend test suite:
```bash
npm test
```

### 4. Setup the Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory (you can copy from `.env.example`):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

Start the frontend development server:

```bash
npm run dev
```

The app will be accessible at the local address provided by Vite (usually `http://localhost:5173`).

## Project Structure

- `frontend/`: React 19 application, pages, and components. See [frontend/README.md](frontend/README.md) for full frontend documentation and architecture.
- `backend/`: Express server, API routes, AI extraction service, and email integrations. See [backend/README.md](backend/README.md) for full backend and API documentation.
- `backend/sql/`: Database schema, views, migrations, and stored procedures for Supabase.

## Documentation Links

- **[Frontend Documentation](frontend/README.md)** - Details on pages, UI components, routing, and state management.
- **[Backend Documentation](backend/README.md)** - Complete API endpoint reference, schema details, authentication flow, and design conventions.

## License

This project is licensed under the ISC License.
