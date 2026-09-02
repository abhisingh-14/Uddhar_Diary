import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { getBalances } from '../api/client.js'
import DiaryTabs from '../components/diary/DiaryTabs.jsx'
import { CURRENT_USER_ID } from '../lib/currentUser.js'

export default function UddharDiaryPage() {
  const [status, setStatus] = useState('loading')
  const [balances, setBalances] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  const loadBalances = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const data = await getBalances(CURRENT_USER_ID)
      setBalances(data.balances ?? [])
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load balances.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  const owedToYou = balances.filter((entry) => entry.netBalancePaise > 0)
  const youOwe = balances.filter((entry) => entry.netBalancePaise < 0)

  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <div className="max-w-[500px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Your ledger
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
            Who owes what
          </h2>
          <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
            Track what people owe you and what you still need to settle up.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              Loading balances…
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={loadBalances}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && <DiaryTabs owedToYou={owedToYou} youOwe={youOwe} />}
        </div>
      </div>
    </div>
  )
}
