import { CheckCircle2 } from 'lucide-react'

export default function SuccessScreen({ result, onStartOver }) {
  const debts = result?.debts ?? []

  return (
    <div className="w-full max-w-[520px] animate-in fade-in duration-500 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <CheckCircle2 className="size-7" strokeWidth={1.8} />
      </div>
      <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">Bill saved</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your split is recorded and everyone&apos;s balance is up to date.
      </p>

      {debts.length > 0 && (
        <div className="mt-8 space-y-2 rounded-2xl border border-border bg-card p-5 text-left">
          {debts.map((debt) => (
            <div key={debt.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {debt.direction === 'they_owe_you' ? 'Owes you' : 'You owe'}
              </span>
              <span className="font-medium">₹{Math.abs(debt.owedAmount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onStartOver}
        className="mt-8 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
      >
        Split another bill
      </button>
    </div>
  )
}
