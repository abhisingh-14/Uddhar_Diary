import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatPaise } from '../../lib/money.js'

export default function PersonBalanceCard({ personId, name, amountPaise }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/diary/${personId}`)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatPaise(amountPaise)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
    </button>
  )
}
