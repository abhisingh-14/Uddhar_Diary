import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SplitBillPage from './pages/SplitBillPage.jsx'
import UddharDiaryPage from './pages/UddharDiaryPage.jsx'
import PersonDetailPage from './pages/PersonDetailPage.jsx'
import ExpenseTrackerPage from './pages/ExpenseTrackerPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ProfileSection from './components/settings/ProfileSection.jsx'
import SecuritySection from './components/settings/SecuritySection.jsx'
import PeopleContacts from './components/settings/PeopleContacts.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'

export default function App() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        {!isAuthPage && <Navbar />}

        <section className="flex min-w-0 flex-1 flex-col">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<Navigate to="/split" replace />} />
            <Route
              path="/split"
              element={
                <ProtectedRoute>
                  <SplitBillPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/diary"
              element={
                <ProtectedRoute>
                  <UddharDiaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/diary/:personId"
              element={
                <ProtectedRoute>
                  <PersonDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <ExpenseTrackerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSection />} />
              <Route path="security" element={<SecuritySection />} />
              <Route path="people" element={<PeopleContacts />} />
            </Route>
          </Routes>
        </section>
      </div>
    </main>
  )
}
