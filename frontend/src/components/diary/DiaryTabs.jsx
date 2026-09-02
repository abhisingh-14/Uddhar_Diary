import { useState } from 'react'
import PersonBalanceCard from './PersonBalanceCard.jsx'

const TABS = [
  { id: 'owedToYou', label: 'Owed to you' },
  { id: 'youOwe', label: 'You owe' },
]

export default function DiaryTabs({ owedToYou, youOwe }) {
  const [activeTab, setActiveTab] = useState('owedToYou')

  const items = activeTab === 'owedToYou' ? owedToYou : youOwe

  return (
    <div>
      <div
        role="tablist"
        aria-label="Balance categories"
        className="flex gap-1 rounded-xl border border-border bg-muted/50 p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-5">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {activeTab === 'owedToYou'
              ? 'No one owes you anything right now'
              : "You're all settled up"}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((entry) => (
              <PersonBalanceCard
                key={entry.personId}
                personId={entry.personId}
                name={entry.name}
                amountPaise={
                  activeTab === 'youOwe'
                    ? Math.abs(entry.netBalancePaise)
                    : entry.netBalancePaise
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
