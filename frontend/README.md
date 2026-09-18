# UddharDiary Frontend

Welcome to the **UddharDiary** frontend application. This is the user-facing side of our comprehensive personal finance and debt tracking application. Built with a beautiful, responsive, and modern interface, it ensures that keeping track of your money and splitting bills is a seamless experience.

## What You See

Our frontend is designed with a focus on simplicity, clarity, and aesthetics, built using **React** and **Tailwind CSS**. It provides a clean dashboard that works perfectly on both desktop and mobile devices.

### Key Pages & Views

- **Dashboard / Uddhar Diary:** The main landing area where you can see a high-level summary of your finances—who owes you money and whom you owe. The summary cards use beautiful typography and clear color codings (e.g., green for positive balances, red for debts).
- **Person Profile Details:** Drill down into your interactions with a specific friend. View a history of transactions and send email reminders directly from their profile with just a click.
- **Expense Tracker:** A dedicated section to log daily expenses. It features visually appealing charts (powered by Recharts) to help you visualize your spending habits across different categories over time.
- **Smart Bill Splitter:** A clean interface where you can upload a picture of a receipt. Once the backend AI extracts the items, the frontend displays an interactive list where you can review prices, select which friends are involved, and split the cost effortlessly.
- **Authentication Pages:** Sleek login and sign-up forms that securely connect to Supabase to keep your financial data private.
- **Settings:** A place to manage your account preferences and user profile.

## User Features

- **Interactive Charts:** Get real-time visual insights into where your money goes.
- **One-Click Reminders:** Don't stress about asking for money back. You can trigger an email reminder to a friend with a single click.
- **AI Receipt Scanning UI:** Instead of manually typing every item on a long dinner receipt, just upload a photo and review the pre-filled list.
- **Responsive Design:** Whether you are splitting a bill at the dinner table using your phone or reviewing your monthly expenses on your laptop, the UI adapts beautifully.
- **Smooth Animations:** Experience micro-interactions and smooth transitions that make financial management feel less like a chore and more engaging.

## Tech Stack (Frontend)

- **React & Vite:** For a lightning-fast development experience and optimized production build.
- **Tailwind CSS:** Used extensively to craft our modern, customized aesthetic.
- **Recharts:** Powers the interactive expense visualizations.
- **Lucide React:** Provides crisp and consistent iconography across the application.
- **Supabase Client:** Handles real-time synchronization, user authentication, and data fetching directly from our secure backend.

---

### Running the Frontend Locally

1. Create a `.env` file in this directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
