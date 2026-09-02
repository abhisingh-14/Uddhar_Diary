import { Navigate, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import SplitBillPage from './pages/SplitBillPage.jsx'
import UddharDiaryPage from './pages/UddharDiaryPage.jsx'
import PersonDetailPage from './pages/PersonDetailPage.jsx'
import ExpenseTrackerPage from './pages/ExpenseTrackerPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <Navbar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Routes>
            <Route path="/" element={<Navigate to="/split" replace />} />
            <Route path="/split" element={<SplitBillPage />} />
            <Route path="/diary" element={<UddharDiaryPage />} />
            <Route path="/diary/:personId" element={<PersonDetailPage />} />
            <Route path="/expenses" element={<ExpenseTrackerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </section>
      </div>
    </main>
  )
}
