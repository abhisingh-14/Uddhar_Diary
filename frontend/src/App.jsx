import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import BottomTabBar from './components/BottomTabBar.jsx'
import MobileHeader from './components/MobileHeader.jsx'
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
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'

export default function App() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password'

  return (
    <main className="h-screen bg-background text-foreground overflow-hidden">
      <div className="flex h-full flex-col md:flex-row">
        {!isAuthPage && <Navbar />}

        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto md:pb-0" style={{ paddingBottom: !isAuthPage ? 'calc(64px + env(safe-area-inset-bottom))' : undefined }}>
          {!isAuthPage && <div className="md:hidden"><MobileHeader /></div>}
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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

        {!isAuthPage && <div className="md:hidden"><BottomTabBar /></div>}
      </div>
    </main>
  )
}
