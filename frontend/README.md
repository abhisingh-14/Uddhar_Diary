# Uddhar Diary - Frontend Application

The modern, responsive web application for **Uddhar Diary**, a personal finance, expense tracking, and debt management platform. Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, and **Supabase**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Development Server](#development-server)
  - [Available Scripts](#available-scripts)
- [Key Pages & User Flows](#key-pages--user-flows)
  - [1. Smart Bill Splitter (`/split`)](#1-smart-bill-splitter-split)
  - [2. Uddhar Diary (`/diary`)](#2-uddhar-diary-diary)
  - [3. Person Detail Ledger (`/diary/:personId`)](#3-person-detail-ledger-diarypersonid)
  - [4. Expense Tracker & Analytics (`/expenses`)](#4-expense-tracker--analytics-expenses)
  - [5. Settings & Profile (`/settings/*`)](#5-settings--profile-settings)
  - [6. Authentication Pages](#6-authentication-pages)
- [Design System & Responsive Layout](#design-system--responsive-layout)
- [Backend Integration](#backend-integration)

---

## Features

- **AI-Powered Receipt Scanning:** Upload receipt photos to automatically extract merchant, date, category, and line items via Google Gemini.
- **Fair Bill Splitting:** Split shared expenses evenly across friends with exact remainder distribution and support for upfront partial contributions.
- **Uddhar (Debt) Ledger:** Dual-view diary separating *"They Owe You"* and *"You Owe Them"* with real-time net balance calculations.
- **Manual Loan Tracking:** Quick-log one-off loans and shared expenses with custom notes, transaction dates, and direction.
- **Debt Settlement:** Settle debts in full or record partial repayments directly in the ledger.
- **One-Click Email Reminders:** Send polite, automated payment reminder emails to friends with positive balances using Resend.
- **Spending Analytics:** Visual charts (powered by Recharts) breaking down spending by category and trends over time (weekly/monthly).
- **Contact Management:** Add friends, update email addresses inline, and prevent duplicate entries.
- **Account Security:** Update profile details, change passwords with current-password re-verification and rate-limiting.
- **Responsive UI:** Tailored dual navigation—collapsible sidebar on desktop and floating bottom tab bar on mobile.

---

## Tech Stack

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^19.2.8` | UI library and component architecture |
| **Vite** | `^8.2.0` | Next-generation frontend tooling and bundler |
| **Tailwind CSS** | `^4.3.3` | Utility-first CSS framework (configured with `@tailwindcss/vite`) |
| **React Router** | `^7.18.3` | Client-side routing with nested layouts and protected routes |
| **Recharts** | `^3.10.1` | Composable charting library for spending visualizations |
| **Lucide React** | `^1.31.0` | Consistent iconography across navigation and actions |
| **Supabase Client** | `^2.116.0` | Client-side user authentication and session management |

---

## Project Structure

```text
frontend/
├── .env.example              # Environment variables template
├── index.html                # Application HTML entry point
├── package.json              # Dependencies and npm scripts
├── vite.config.js            # Vite configuration with React & Tailwind plugins
└── src/
    ├── main.jsx              # App entry rendering BrowserRouter & AuthProvider
    ├── App.jsx               # Top-level layout and route configuration
    ├── App.css / index.css   # Global styles and Tailwind CSS v4 design tokens
    ├── api/
    │   └── client.js         # Authenticated fetch wrapper injecting Supabase Bearer tokens
    ├── context/
    │   └── AuthContext.jsx   # Authentication state, login, signup, and session listener
    ├── lib/
    │   └── supabaseClient.js # Supabase client instance initialized from env
    ├── components/
    │   ├── Navbar.jsx            # Desktop sidebar navigation
    │   ├── BottomTabBar.jsx      # Mobile bottom navigation bar
    │   ├── MobileHeader.jsx      # Mobile header with logo and user initials
    │   ├── ProtectedRoute.jsx    # Route guard redirecting unauthenticated users to /login
    │   ├── BillSplitWizard.jsx   # Multi-step bill splitting container
    │   ├── QuickAmountForm.jsx   # Manual bill amount input screen
    │   ├── ReviewScreen.jsx      # Review & edit extracted receipt items
    │   ├── SplitScreen.jsx       # Select participants, payer, and upfront payments
    │   ├── SuccessScreen.jsx     # Bill creation confirmation screen
    │   ├── diary/
    │   │   ├── DiaryTabs.jsx         # "They Owe You" / "You Owe Them" tab toggles
    │   │   ├── PersonBalanceCard.jsx # Contact summary card with net balance
    │   │   ├── DebtHistoryItem.jsx   # Individual debt row with status & action buttons
    │   │   └── AddDueModal.jsx       # Modal to record manual loans/expenses
    │   ├── expenses/
    │   │   ├── CategoryBreakdown.jsx # Spending distribution chart by category
    │   │   └── SpendOverTime.jsx     # Time-series spending bar chart
    │   └── settings/
    │       ├── ProfileSection.jsx    # View email and update full name
    │       ├── SecuritySection.jsx   # Secure password change form
    │       └── PeopleContacts.jsx    # Contact list with inline edit & add person
    └── pages/
        ├── SplitBillPage.jsx       # Smart Bill Splitter view
        ├── UddharDiaryPage.jsx     # Overview of balances and contact cards
        ├── PersonDetailPage.jsx    # Transaction history with a specific person
        ├── ExpenseTrackerPage.jsx  # Spending analytics and visualizations
        ├── SettingsPage.jsx        # Tabbed settings layout (Profile, Security, People)
        ├── LoginPage.jsx           # Sign in with email and password
        ├── SignupPage.jsx          # Register new account with password strength meter
        ├── ForgotPasswordPage.jsx  # Password recovery request form
        └── ResetPasswordPage.jsx   # Password reset target form with token validation
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- Backend server running (default: `http://localhost:3001`)
- Supabase project credentials

### Installation

Navigate to the `frontend` directory and install dependencies:

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env` file in the `frontend` directory based on `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend API Base URL
VITE_API_URL=http://localhost:3001
```

> **Note:** If `VITE_API_URL` is omitted, `src/api/client.js` automatically defaults to `http://localhost:3001`.

### Development Server

Start the local development server:

```bash
npm run dev
```

The frontend will run at `http://localhost:5173` (or the port specified by Vite).

### Available Scripts

- **`npm run dev`**: Starts Vite dev server with hot module replacement (HMR).
- **`npm run build`**: Compiles and bundles production-ready assets into the `dist/` directory.
- **`npm run preview`**: Locally serves the production build from `dist/` for verification.
- **`npm run lint`**: Runs ESLint across all source files.

---

## Key Pages & User Flows

### 1. Smart Bill Splitter (`/split`)
A guided multi-step wizard to record and split expenses:
1. **Entry Mode:** Choose between **Quick Amount** (enter total and optional merchant manually) or **Scan Receipt** (upload image from file/camera).
2. **AI Extraction:** When an image is uploaded, Google Gemini extracts line items, prices, merchant name, category, and date.
3. **Review Screen:** Modify any extracted items, edit the total, adjust category, or add custom line items.
4. **Split Screen:**
   - Select who paid: **"You"** or any friend in your contacts.
   - Choose participants included in the split.
   - (Optional) Record if any participant already paid upfront towards their share.
   - Live breakdown shows each person's exact share in rupees.
5. **Success Screen:** Displays confirmed debts created and provides quick links back to the Diary or to split another bill.

### 2. Uddhar Diary (`/diary`)
The primary financial dashboard:
- **Balance Cards:** Real-time summary metrics showing total money owed to you and total money you owe others.
- **Dual Tabs:**
  - **"They Owe You":** Lists contacts who owe you money with positive green indicators.
  - **"You Owe Them":** Lists contacts you need to pay back with red debt indicators.
- **Add Due Modal:** Instantly log manual cash loans or shared payments without needing a bill photo.

### 3. Person Detail Ledger (`/diary/:personId`)
Detailed transaction ledger for a single contact:
- Displays contact name, email status, and current net balance.
- Chronological list of all debts with tags (`Bill Split` vs. `Manual Loan`, transaction date, and notes).
- **Settlement:** Click **Settle** to record a full or partial payment.
- **Edit / Delete:** Edit or delete unsettled manual loans directly.
- **Send Reminder:** Trigger a Resend reminder email with a single click (enabled if contact has an email and positive balance).

### 4. Expense Tracker & Analytics (`/expenses`)
Visual financial intelligence:
- **Category Breakdown:** Donut/pie chart illustrating personal spending across categories (Food, Travel, Groceries, etc.).
- **Spend Over Time:** Interactive bar chart displaying spending trends. Supports switching between **Weekly** and **Monthly** intervals.

### 5. Settings & Profile (`/settings/*`)
Tabbed configuration panel:
- **Profile (`/settings/profile`):** View registered email and update full name.
- **Security (`/settings/security`):** Secure password update requiring verification of current password, reinforced with brute-force rate-limiting on the backend.
- **People (`/settings/people`):** View and manage your contact list. Add new friends, update their email addresses inline, and ensure unique contact names.

### 6. Authentication Pages
- **Sign In (`/login`):** Email and password authentication with remember-me state.
- **Sign Up (`/signup`):** New user registration with password strength requirements.
- **Forgot Password (`/forgot-password`):** Send password reset link to user's registered email.
- **Reset Password (`/reset-password`):** Secure form accessed via Supabase recovery email link to establish a new password.

---

## Design System & Responsive Layout

- **Tailwind CSS v4 Tokens:** Styled using modern tokens (`surface-container-lowest`, `on-surface`, `primary`, `success`, `error`) defined in `src/index.css`.
- **Desktop Navigation:** Left collapsible sidebar navigation (`Navbar.jsx`) with quick access to Split Bill, Uddhar Diary, Expense Tracker, and Settings.
- **Mobile Navigation:** Floating bottom tab bar (`BottomTabBar.jsx`) accompanied by a lightweight header (`MobileHeader.jsx`).
- **Interactive Feedback:** Micro-animations, loading spinners, optimistic UI updates, and clear empty states across all screens.

---

## Backend Integration

The frontend communicates with the Uddhar Diary Express backend through `src/api/client.js`. All API requests automatically:
1. Fetch the active user session from Supabase Client.
2. Inject the JWT into `Authorization: Bearer <token>`.
3. Catch and parse structured error responses (e.g., `409 PERSON_EXISTS`, `429 RATE_LIMITED`) to render contextual inline feedback in UI forms.
