import { CheckCircle2, Loader2 } from 'lucide-react'
import { formatPaise } from '../../lib/money.js'
import { useState } from 'react'

function formatDebtDate(debt) {
  const raw = debt.incurredOn ?? debt.billDate ?? debt.createdAt
  if (!raw) return null

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(raw))
}

export default function DebtHistoryItem({ debt, onSettle, onEdit, onDelete }) {
  const isSettled = debt.remainingPaise <= 0 || debt.settledAt != null
  const directionLabel =
    debt.direction === 'they_owe_you' ? 'They owe you' : 'You owe them'
  const formattedDate = formatDebtDate(debt)
  const isManualDebt = debt.kind !== 'bill'
  const canEditDelete = isManualDebt && debt.amountPaidPaise === 0

  const [showSettleForm, setShowSettleForm] = useState(false)
  const [amountPaise, setAmountPaise] = useState(debt.remainingPaise)
  const [isSettling, setIsSettling] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      await onDelete(debt)
    } catch (err) {
      setError(err.message || 'Failed to delete debt')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  return (
    <div
      className={`rounded-xl px-4 py-3.5 transition-colors ${
        isSettled
          ? 'bg-surface-container/40'
          : 'bg-surface-container'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`font-body text-sm font-medium ${
              isSettled ? 'text-on-surface-variant' : 'text-on-surface'
            }`}
          >
            {directionLabel}
          </p>
          {debt.merchantName ? (
            <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">{debt.merchantName}</p>
          ) : isManualDebt && (
            <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">
              {debt.kind === 'old_due' ? 'Old due' : 'Loan'}
            </p>
          )}
          {debt.note && (
            <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">{debt.note}</p>
          )}
          {formattedDate && (
            <p className="mt-1 font-body text-[11px] text-on-surface-variant">{formattedDate}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`font-body text-sm font-semibold tabular-nums ${
              isSettled
                ? 'text-on-surface-variant line-through decoration-on-surface-variant/60'
                : debt.direction === 'you_owe_them'
                  ? 'text-error'
                  : 'text-on-surface'
            }`}
          >
            {formatPaise(debt.amountPaise)}
          </p>
          {!isSettled && debt.remainingPaise < debt.amountPaise && (
            <p className="mt-0.5 font-body text-[11px] text-on-surface-variant">
              {formatPaise(debt.remainingPaise)} remaining
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        {isSettled ? (
          <>
            <CheckCircle2 className="size-3.5 text-on-surface-variant" strokeWidth={1.8} />
            <span className="font-body text-[11px] font-medium text-on-surface-variant">Settled</span>
          </>
        ) : (
          <>
            <span className="rounded-full bg-primary-container/15 px-2 py-0.5 font-body text-[11px] font-medium text-primary">
              Outstanding
            </span>
            {!showSettleForm && (
              <button
                type="button"
                onClick={handleSettleClick}
                className="ml-auto rounded-lg bg-primary-container px-2.5 py-1 font-body text-[11px] font-semibold text-on-primary-container transition-colors hover:bg-secondary-container"
              >
                Settle
              </button>
            )}
          </>
        )}
        {canEditDelete && !showDeleteConfirm && (
          <>
            <button
              type="button"
              onClick={() => onEdit(debt)}
              disabled={isSettling || isDeleting}
              className="rounded-lg bg-surface-container-high px-2.5 py-1 font-body text-[11px] font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-40"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isSettling || isDeleting}
              className="rounded-lg bg-surface-container-high px-2.5 py-1 font-body text-[11px] font-medium text-error transition-colors hover:bg-error-container/20 disabled:opacity-40"
            >
              Delete
            </button>
          </>
        )}
        {showDeleteConfirm && (
          <div className="ml-auto flex items-center gap-2 font-body text-[11px]">
            <span className="text-on-surface-variant">Delete?</span>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="rounded-lg bg-error-container px-2 py-0.5 font-medium text-on-error-container transition-colors hover:bg-error-container/80 disabled:opacity-40"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="rounded-lg bg-surface-container-high px-2 py-0.5 font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-40"
            >
              No
            </button>
          </div>
        )}
      </div>

      {showSettleForm && (
        <div className="mt-3 rounded-xl bg-surface-container-low p-3.5 shadow-md">
          <form onSubmit={handleSubmitSettle} className="space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor={`settle-amount-${debt.id}`} className="font-body text-xs text-on-surface-variant">
                Amount to pay:
              </label>
              <input
                id={`settle-amount-${debt.id}`}
                type="number"
                value={amountPaise}
                onChange={handleAmountChange}
                disabled={isSettling}
                className="flex-1 rounded-lg bg-surface-container-lowest px-2.5 py-1 font-body text-xs text-on-surface tabular-nums outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                min="1"
                max={debt.remainingPaise}
              />
              <span className="font-body text-xs text-on-surface-variant">paise</span>
            </div>
            {error && (
              <p className="font-body text-[11px] text-error">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSettling || !!error}
                className="flex-1 rounded-lg bg-primary-container px-3 py-1.5 font-body text-xs font-semibold text-on-primary-container transition-colors hover:bg-secondary-container disabled:opacity-50"
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
                className="rounded-lg bg-surface-container-high px-3 py-1.5 font-body text-xs font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-50"
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
