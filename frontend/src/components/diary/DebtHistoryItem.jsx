import { CheckCircle2 } from 'lucide-react'
import { formatPaise } from '../../lib/money.js'

function formatDebtDate(debt) {
  const raw = debt.billDate ?? debt.createdAt
  if (!raw) return null

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(raw))
}

export default function DebtHistoryItem({ debt }) {
  const isSettled = debt.remainingPaise <= 0 || debt.settledAt != null
  const directionLabel =
    debt.direction === 'they_owe_you' ? 'They owe you' : 'You owe them'
  const formattedDate = formatDebtDate(debt)

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        isSettled
          ? 'border-border/60 bg-muted/30'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              isSettled ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {directionLabel}
          </p>
          {debt.merchantName && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{debt.merchantName}</p>
          )}
          {formattedDate && (
            <p className="mt-1 text-[11px] text-muted-foreground">{formattedDate}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-semibold tabular-nums ${
              isSettled
                ? 'text-muted-foreground line-through decoration-muted-foreground/60'
                : debt.direction === 'you_owe_them'
                  ? 'text-destructive'
                  : 'text-foreground'
            }`}
          >
            {formatPaise(debt.amountPaise)}
          </p>
          {!isSettled && debt.remainingPaise < debt.amountPaise && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatPaise(debt.remainingPaise)} remaining
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        {isSettled ? (
          <>
            <CheckCircle2 className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
            <span className="text-[11px] font-medium text-muted-foreground">Settled</span>
          </>
        ) : (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Outstanding
          </span>
        )}
      </div>
    </div>
  )
}
