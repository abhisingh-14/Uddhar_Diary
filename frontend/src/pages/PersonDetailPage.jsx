import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2, UserX } from 'lucide-react'
import { apiClient, getPersonDebts } from '../api/client.js'
import DebtHistoryItem from '../components/diary/DebtHistoryItem.jsx'
import { CURRENT_USER_ID } from '../lib/currentUser.js'
import { formatPaise } from '../lib/money.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function computeNetBalancePaise(debts) {
  return debts.reduce((sum, debt) => {
    if (debt.direction === 'they_owe_you') {
      return sum + debt.remainingPaise
    }
    return sum - debt.remainingPaise
  }, 0)
}

function netBalanceLabel(netBalancePaise) {
  if (netBalancePaise > 0) {
    return { prefix: 'They owe you', amountPaise: netBalancePaise, tone: 'positive' }
  }
  if (netBalancePaise < 0) {
    return { prefix: 'You owe them', amountPaise: Math.abs(netBalancePaise), tone: 'negative' }
  }
  return { prefix: 'All settled up', amountPaise: 0, tone: 'neutral' }
}

export default function PersonDetailPage() {
  const { personId } = useParams()
  const [status, setStatus] = useState('loading')
  const [personName, setPersonName] = useState('')
  const [debts, setDebts] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  const loadDebtHistory = useCallback(async () => {
    if (!personId || !UUID_PATTERN.test(personId)) {
      setStatus('notFound')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const [debtsData, people] = await Promise.all([
        getPersonDebts(personId, CURRENT_USER_ID),
        apiClient(`/api/people?userId=${encodeURIComponent(CURRENT_USER_ID)}`),
      ])

      const person = people.find((entry) => entry.id === personId)
      setPersonName(person?.name ?? 'Unknown person')
      setDebts(debtsData.debts ?? [])
      setStatus('ready')
    } catch (err) {
      const message = err.message || 'Failed to load debt history.'
      if (message === 'Person not found' || message === 'personId is invalid') {
        setStatus('notFound')
        return
      }
      setErrorMessage(message)
      setStatus('error')
    }
  }, [personId])

  useEffect(() => {
    loadDebtHistory()
  }, [loadDebtHistory])

  const netBalancePaise = useMemo(() => computeNetBalancePaise(debts), [debts])
  const summary = netBalanceLabel(netBalancePaise)

  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <Link
          to="/diary"
          className="group mb-6 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Uddhar Diary
        </Link>

        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
            Loading debt history…
          </div>
        )}

        {status === 'notFound' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
            <UserX className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold text-foreground">Person not found</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              This person doesn&apos;t exist or isn&apos;t linked to your account.
            </p>
            <Link
              to="/diary"
              className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Back to Uddhar Diary
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={loadDebtHistory}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="max-w-[500px]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Debt history
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
                {personName}
              </h2>
              <p
                className={`mt-4 text-sm font-medium ${
                  summary.tone === 'negative'
                    ? 'text-destructive'
                    : summary.tone === 'positive'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {summary.prefix}
                {summary.amountPaise > 0 && (
                  <span className="ml-1.5 tabular-nums">{formatPaise(summary.amountPaise)}</span>
                )}
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
              {debts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  No debt entries yet for this person.
                </p>
              ) : (
                <div className="space-y-2">
                  {debts.map((debt) => (
                    <DebtHistoryItem key={debt.id} debt={debt} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
