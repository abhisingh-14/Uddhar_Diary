import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Calculator, Settings, WalletCards, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo.jsx'
import { useState, useEffect } from 'react'

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
      return saved === 'true'
    } catch (error) {
      console.error('Failed to read sidebar state from localStorage', error)
      return false
    }
  })

  const toggleCollapse = () => {
    const newState = !collapsed
    setCollapsed(newState)
    try {
      localStorage.setItem('sidebarCollapsed', String(newState))
    } catch (error) {
      console.error('Failed to save sidebar state to localStorage', error)
    }
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
    <aside className="hidden md:flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200 sticky top-0 left-0 z-10" style={{ width: collapsed ? '5rem' : '15rem' }}>
      <div className="flex items-center px-6 py-7">
        <div className="flex items-center justify-center flex-1">
          <Logo size={collapsed ? 32 : 40} />
        </div>
        {!collapsed && (
          <div className="ml-3">
            <p className="font-sans text-[15px] font-semibold tracking-tight">Uddhar Diary</p>
            <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            className="ml-auto shrink-0 p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="size-5" />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="flex justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      )}

      <nav aria-label="Main navigation" className="flex flex-col gap-1.5 px-3 mt-9">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={false}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/70'
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5 px-3 pb-6">
        <button
          onClick={handleLogout}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className="size-[17px] shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="whitespace-nowrap">Log out</span>}
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
  )
}
