import { CheckCircle2, Loader2 } from 'lucide-react'
import { formatPaise } from '../../lib/money.js'
import { useState } from 'react'

function formatDebtDate(debt) {
  const raw = debt.billDate ?? debt.createdAt
  if (!raw) return null

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(raw))
}

export default function DebtHistoryItem({ debt, onSettle }) {
  const isSettled = debt.remainingPaise <= 0 || debt.settledAt != null
  const directionLabel =
    debt.direction === 'they_owe_you' ? 'They owe you' : 'You owe them'
  const formattedDate = formatDebtDate(debt)

  const [showSettleForm, setShowSettleForm] = useState(false)
  const [amountPaise, setAmountPaise] = useState(debt.remainingPaise)
  const [isSettling, setIsSettling] = useState(false)
  const [error, setError] = useState('')

  const handleSettleClick = () => {
    setShowSettleForm(true)
    setAmountPaise(debt.remainingPaise)
    setError('')
  }

  const handleCancelSettle = () => {
    setShowSettleForm(false)
    setAmountPaise(debt.remainingPaise)
    setError('')
  }

  const validateAmount = (value) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num <= 0) {
      return 'Amount must be a positive number'
    }
    if (num > debt.remainingPaise) {
      return 'Amount cannot exceed remaining balance'
    }
    return ''
  }

  const handleAmountChange = (e) => {
    const value = e.target.value
    setAmountPaise(value)
    setError(validateAmount(value))
  }

  const handleSubmitSettle = async (e) => {
    e.preventDefault()
    const validationError = validateAmount(amountPaise)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSettling(true)
    setError('')

    try {
      await onSettle(debt.id, parseInt(amountPaise, 10))
      setShowSettleForm(false)
    } catch (err) {
      setError(err.message || 'Failed to settle debt')
    } finally {
      setIsSettling(false)
    }
  }

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
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Outstanding
            </span>
            {!showSettleForm && (
              <button
                type="button"
                onClick={handleSettleClick}
                className="ml-auto rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Settle
              </button>
            )}
          </>
        )}
      </div>

      {showSettleForm && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <form onSubmit={handleSubmitSettle} className="space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor={`settle-amount-${debt.id}`} className="text-xs text-muted-foreground">
                Amount to pay:
              </label>
              <input
                id={`settle-amount-${debt.id}`}
                type="number"
                value={amountPaise}
                onChange={handleAmountChange}
                disabled={isSettling}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                min="1"
                max={debt.remainingPaise}
              />
              <span className="text-xs text-muted-foreground">paise</span>
            </div>
            {error && (
              <p className="text-[11px] text-destructive">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSettling || !!error}
                className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSettling ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" strokeWidth={1.8} />
                    Settling...
                  </span>
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelSettle}
                disabled={isSettling}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
