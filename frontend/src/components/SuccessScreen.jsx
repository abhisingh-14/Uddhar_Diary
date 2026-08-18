import { CheckCircle2 } from 'lucide-react'

export default function SuccessScreen({ result, onStartOver }) {
  const debts = result?.debts ?? []
  const merchantName = result?.merchantName ?? 'Your bill'
  const total = Number(result?.total ?? 0)

  return (
    <div className="w-full max-w-[520px] animate-in fade-in duration-500 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <CheckCircle2 className="size-7" strokeWidth={1.8} />
      </div>
      <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">Bill saved</h2>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Bill summary</p>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="min-w-0 truncate text-base font-semibold">{merchantName}</span>
          <span className="shrink-0 text-lg font-semibold">₹{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Who owes what</p>
        {debts.length > 0 ? (
          <div className="mt-3 space-y-3">
          {debts.map((debt) => (
            <div key={debt.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate font-medium">{debt.personName}</span>
              <span className="shrink-0 text-muted-foreground">
                {debt.direction === 'they_owe_you' ? `owes you ₹${Math.abs(debt.owedAmount).toFixed(2)}` : `you owe ₹${Math.abs(debt.owedAmount).toFixed(2)}`}
              </span>
            </div>
          ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Everyone is settled up.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="mt-8 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
      >
        Start a new Split Bill
      </button>
    </div>
  )
}
