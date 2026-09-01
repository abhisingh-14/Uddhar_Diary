import SplitBillPage from './pages/SplitBillPage.jsx'
import {
  BarChart3,
  Calculator,
  Settings,
  Sparkles,
  WalletCards,
} from 'lucide-react'

const navItems = [
  { label: 'Split Bill', icon: Calculator, active: true },
  { label: 'Expense Tracker', icon: BarChart3, comingSoon: true },
  { label: 'Uddhar Diary', icon: WalletCards, comingSoon: true },
  { label: 'Settings', icon: Settings, comingSoon: true },
]

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b border-border bg-sidebar px-5 py-6 md:w-[250px] md:border-b-0 md:border-r md:px-6 md:py-7">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-[17px]" strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-sans text-[15px] font-semibold tracking-[-0.02em]">Uddhar Diary</p>
              <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
            </div>
          </div>

          <nav aria-label="Main navigation" className="mt-9 flex gap-1.5 overflow-x-auto md:flex-col">
            {navItems.map(({ label, icon: Icon, active, comingSoon }) => (
              <button
                key={label}
                type="button"
                disabled={comingSoon}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors md:w-full ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70'
                } ${comingSoon ? 'cursor-not-allowed opacity-45' : ''}`}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
                <span className="whitespace-nowrap">{label}</span>
                {comingSoon && <span className="ml-auto hidden text-[10px] md:block">Soon</span>}
              </button>
            ))}
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

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-4 md:px-12 md:py-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Workspace / Split Bill</p>
              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Split a bill</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Personal workspace
            </div>
          </header>

          <SplitBillPage />
        </section>
      </div>
    </main>
  )
}
