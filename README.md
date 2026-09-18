# UddharDiary

UddharDiary is a comprehensive personal finance and debt tracking application. "Uddhar" is a Hindi word meaning "borrowing" or "debt". The app helps you keep track of your daily expenses, manage debts with friends, and split bills effortlessly with the power of AI.

## Features

- **Authentication & Security:** Secure user sign-up and login powered by Supabase.
- **Expense Tracking:** Monitor your daily expenses, categorize them, and visualize your spending habits.
- **Uddhar (Debt) Diary:** Keep a detailed log of people who owe you money or to whom you owe money. View individual profiles to see transaction history.
- **AI-Powered Bill Splitting:** Upload receipt images and let Gemini AI automatically extract items and prices. Split the bill evenly among friends with just a few clicks.
- **Email Reminders:** Send automated email reminders to friends who owe you money, powered by Resend.
- **Responsive Dashboard:** A beautiful and modern user interface built with React and Tailwind CSS.

## Tech Stack

**Frontend:**
- React (Vite)
- Tailwind CSS
- Recharts (for data visualization)
- Lucide React (for icons)
- Supabase Client

**Backend:**
- Node.js & Express
- Supabase (Database & Authentication)
- Google Generative AI (Gemini for receipt extraction)
- Resend (Email service)
- Multer (for image uploads)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- A Supabase project
- A Google Gemini API key
- A Resend API key (optional, for email features)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd UddharDiary
```

### 2. Setup the Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory with the following variables:

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Start the backend server:

```bash
npm start
```
The server will run on `http://localhost:3001`.

### 3. Setup the Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the frontend development server:

```bash
npm run dev
```

The app will be accessible at the local address provided by Vite (usually `http://localhost:5173`).

## Project Structure

- `frontend/`: Contains the React application, pages, and UI components.
- `backend/`: Contains the Express server, API routes, AI extraction service, and email integrations.
- `backend/sql/`: (If applicable) SQL scripts for setting up the Supabase database schema.

## License

This project is licensed under the ISC License.
