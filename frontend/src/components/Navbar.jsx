import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, BarChart3, Calculator, Settings, WalletCards, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo.jsx'

export const navItems = [
  { label: 'Split Bill', icon: Calculator, path: '/split', shortLabel: 'Split' },
  { label: 'Expense Tracker', icon: BarChart3, path: '/expenses', shortLabel: 'Expenses' },
  { label: 'Uddhar Diary', icon: WalletCards, path: '/diary', shortLabel: 'Diary' },
  { label: 'Settings', icon: Settings, path: '/settings', shortLabel: 'Settings' },
]

export default function Navbar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed')
      if (saved !== null) {
        return saved === 'true'
      }
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to read sidebar state from localStorage', error)
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebarCollapsed', String(next))
      } catch (error) {
        console.error('Failed to save sidebar state to localStorage', error)
      }
      return next
    })
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  return (
    <>
      <aside
        className={`relative hidden md:flex h-screen flex-col shrink-0 border-r border-border bg-sidebar transition-[width] duration-300 ease-in-out sticky top-0 left-0 z-20 ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="absolute top-1/2 -translate-y-1/2 -right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#111] text-gray-300 shadow-md transition-all hover:bg-[#1a1a1a] hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="size-4" strokeWidth={2} />
          ) : (
            <ChevronLeft className="size-4" strokeWidth={2} />
          )}
        </button>

        {/* Header */}
        <div className={`flex items-center py-7 h-20 ${collapsed ? 'justify-center px-2' : 'px-6 gap-3'}`}>
          <div className="shrink-0 flex items-center justify-center">
            <Logo size={collapsed ? 32 : 38} />
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden whitespace-nowrap">
              <p className="font-sans text-[15px] font-semibold tracking-tight text-foreground">Uddhar Diary</p>
              <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav
          aria-label="Main navigation"
          className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-1.5 ${
            collapsed ? 'px-2' : 'px-3'
          }`}
        >
          {navItems.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              end={false}
              className={({ isActive }) =>
                `group flex items-center rounded-xl text-left text-[13px] font-medium transition-colors ${
                  collapsed
                    ? 'w-12 h-12 justify-center mx-auto'
                    : 'w-full gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`
              }
              title={label}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom footer / logout */}
        <div className={`mt-auto flex flex-col gap-1.5 pb-6 ${collapsed ? 'px-2' : 'px-3'}`}>
          <button
            type="button"
            onClick={handleLogout}
            className={`group flex items-center rounded-xl text-left text-[13px] font-medium transition-colors text-muted-foreground hover:bg-muted/70 hover:text-foreground cursor-pointer ${
              collapsed
                ? 'w-12 h-12 justify-center mx-auto'
                : 'w-full gap-3 px-3 py-2.5'
            }`}
            title="Log out"
          >
            <LogOut className="size-[18px] shrink-0" strokeWidth={1.8} />
            {!collapsed && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Log out</span>}
          </button>

          {!collapsed && (
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Your private ledger</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Bills stay organized, so settling up stays simple.</p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                All systems ready
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile bottom navigation bar */}
      <nav aria-label="Mobile navigation" className="fixed bottom-0 inset-x-0 flex md:hidden border-t border-white/10 bg-surface-container-lowest z-50 pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ shortLabel, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={false}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center min-h-[44px] py-2 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="size-6" strokeWidth={1.8} />
            <span className="mt-1 text-[11px] font-medium">{shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
