import { CheckCircle2 } from 'lucide-react'

export default function SuccessScreen({ result, onStartOver }) {
  const debts = result?.debts ?? []
  const merchantName = result?.merchantName?.trim() || 'Quick split'
  const total = Number(result?.total ?? 0)

  return (
    <div className="w-full max-w-[520px] animate-in fade-in duration-500 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-container text-primary">
        <CheckCircle2 className="size-7" strokeWidth={1.8} />
      </div>
      <h2 className="mt-6 font-headline text-3xl font-semibold tracking-[-0.04em] text-on-surface">Bill saved</h2>

      <div className="mt-6 rounded-2xl bg-surface-container-low p-5 text-left shadow-2xl">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-on-surface-variant">Bill summary</p>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="min-w-0 truncate font-headline text-base font-semibold text-on-surface">{merchantName}</span>
          <span className="shrink-0 text-lg font-semibold text-on-surface">₹{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-surface-container-low p-5 text-left shadow-2xl">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-on-surface-variant">Who owes what</p>
        {debts.length > 0 ? (
          <div className="mt-3 space-y-3">
          {debts.map((debt) => (
            <div key={debt.id} className="flex items-center justify-between gap-4 font-body text-sm">
              <span className="min-w-0 truncate font-medium text-on-surface">{debt.personName}</span>
              <span className="shrink-0 text-on-surface-variant">
                {debt.direction === 'they_owe_you' ? `owes you ₹${(debt.amountPaise / 100).toFixed(2)}` : `you owe ₹${(debt.amountPaise / 100).toFixed(2)}`}
              </span>
            </div>
          ))}
          </div>
        ) : (
          <p className="mt-3 font-body text-sm text-on-surface-variant">Everyone is settled up.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="mt-8 rounded-xl bg-primary-container px-5 py-2.5 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container"
      >
        Start a new Split Bill
      </button>
    </div>
  )
}
