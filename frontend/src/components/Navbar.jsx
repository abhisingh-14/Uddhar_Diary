import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Calculator, Settings, WalletCards, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo.jsx'

const navItems = [
  { label: 'Split Bill', icon: Calculator, path: '/split' },
  { label: 'Expense Tracker', icon: BarChart3, path: '/expenses' },
  { label: 'Uddhar Diary', icon: WalletCards, path: '/diary' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

export default function Navbar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  return (
    <aside className="flex w-full flex-col border-b border-border bg-sidebar px-5 py-6 md:w-[250px] md:border-b-0 md:border-r md:px-6 md:py-7">
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div>
          <p className="font-sans text-[15px] font-semibold tracking-tight">Uddhar Diary</p>
          <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="mt-9 flex gap-1.5 overflow-x-auto md:flex-col">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors md:w-full ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/70'
              }`
            }
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
            <span className="whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors md:w-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        >
          <LogOut className="size-[17px] shrink-0" strokeWidth={1.8} />
          <span className="whitespace-nowrap">Log out</span>
        </button>
      </nav>

      <div className="mt-auto hidden rounded-2xl border border-border bg-background/60 p-4 md:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Your private ledger</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Bills stay organized, so settling up stays simple.</p>
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          All systems ready
        </div>
      </div>
    </aside>
  )
}
