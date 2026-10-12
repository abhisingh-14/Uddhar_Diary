import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatPaise } from '../../lib/money.js'

export default function PersonBalanceCard({ personId, name, amountPaise }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/diary/${personId}`)}
      className="group flex w-full items-center gap-3 rounded-xl bg-surface-container px-4 py-3.5 text-left transition-colors hover:bg-surface-container-high hover:ring-1 hover:ring-primary/40"
    >
      <span className="min-w-0 flex-1 truncate font-body text-sm font-medium text-on-surface">{name}</span>
      <span className="shrink-0 font-body text-sm font-semibold tabular-nums text-on-surface">
        {formatPaise(amountPaise)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
    </button>
  )
}
