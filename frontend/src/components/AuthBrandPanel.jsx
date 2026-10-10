import Logo from './Logo'
import { ScanLine, PieChart, MailCheck } from 'lucide-react'

export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-7/12 flex-col justify-start gap-10 p-8 sm:p-12 lg:p-20 relative overflow-hidden bg-surface-container-lowest"
      style={{ backgroundImage: 'radial-gradient(circle at 35% 45%, rgba(16, 185, 129, 0.08) 0%, rgba(14, 14, 14, 0) 65%)' }}>
      
      {/* Logo and brand identity */}
      <div className="flex items-center gap-3.5 z-10">
        <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-2">
          <Logo size={36} />
        </div>
        <div className="flex flex-col">
          <span className="font-headline text-headline-sm tracking-tight text-on-surface">Uddhar Diary</span>
          <span className="font-body text-label-sm tracking-wider uppercase text-outline">Ledger · Settlements</span>
        </div>
      </div>

      {/* Main headline */}
      <div className="my-0 max-w-xl z-10 flex flex-col gap-8">
        <div className="space-y-4">
          <h1 className="font-headline text-headline-xl text-on-surface leading-tight tracking-tight">
            Split the bill.<br />
            <span className="text-on-surface-variant font-headline text-headline-lg font-normal">
              Never lose track of who owes what.
            </span>
          </h1>
        </div>

        {/* Feature cards */}
        <div className="space-y-4">
          {/* Scan a bill photo */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <ScanLine size={20} />
            </div>
            <div className="space-y-0.5">
              <div className="font-headline text-body-lg font-medium text-on-surface">Scan a bill photo</div>
              <p className="font-body text-body-sm text-outline leading-relaxed">
                Auto-detect line items, tax, and tip instantly with precision OCR extraction.
              </p>
            </div>
          </div>

          {/* Split with friends */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <PieChart size={20} />
            </div>
            <div className="space-y-0.5">
              <div className="font-headline text-body-lg font-medium text-on-surface">Split with friends</div>
              <p className="font-body text-body-sm text-outline leading-relaxed">
                Divide expenses evenly or by custom percentages. Everyone pays their fair share.
              </p>
            </div>
          </div>

          {/* Gentle email reminders */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <MailCheck size={20} />
            </div>
            <div className="space-y-0.5">
              <div className="font-headline text-body-lg font-medium text-on-surface">Gentle email reminders</div>
              <p className="font-body text-body-sm text-outline leading-relaxed">
                Send friendly nudge emails when debts are overdue. No awkward conversations needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
