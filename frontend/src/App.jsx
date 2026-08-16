import { useRef, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Calculator,
  Check,
  FileImage,
  ImagePlus,
  Settings,
  Sparkles,
  WalletCards,
} from 'lucide-react'

const navItems = [
  { label: 'Split Bill', icon: Calculator, active: true },
  { label: 'Expense Tracker', icon: BarChart3, comingSoon: true },
  { label: 'Uddhar Diary', icon: WalletCards, comingSoon: true },
  { label: 'Settings', icon: Settings, comingSoon: true },
]

export default function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  function selectFile(nextFile) {
    if (nextFile && nextFile.type.startsWith('image/')) setFile(nextFile)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b border-border bg-sidebar px-5 py-6 md:w-[250px] md:border-b-0 md:border-r md:px-6 md:py-7">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-[17px]" strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-sans text-[15px] font-semibold tracking-[-0.02em]">Uddhar Diary</p>
              <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
            </div>
          </div>

          <nav aria-label="Main navigation" className="mt-9 flex gap-1.5 overflow-x-auto md:flex-col">
            {navItems.map(({ label, icon: Icon, active, comingSoon }) => (
              <button
                key={label}
                type="button"
                disabled={comingSoon}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors md:w-full ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70'
                } ${comingSoon ? 'cursor-not-allowed opacity-45' : ''}`}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
                <span className="whitespace-nowrap">{label}</span>
                {comingSoon && <span className="ml-auto hidden text-[10px] md:block">Soon</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto hidden rounded-2xl border border-border bg-background/60 p-4 md:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Your private ledger</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Bills stay organized, so settling up stays simple.</p>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              All systems ready
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-4 md:px-12 md:py-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Workspace / Split Bill</p>
              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Split a bill</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Personal workspace
            </div>
          </header>

          <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
            <div className="w-full max-w-[760px]">
              <div className="max-w-[500px]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start with a photo</p>
                <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">Turn a receipt into a fair split.</h2>
                <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">Upload a clear photo of your bill and we&apos;ll identify the items, totals, and taxes for you.</p>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
                  onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files[0]) }}
                  className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors ${isDragging ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40'}`}
                >
                  <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-primary">
                    <ImagePlus className="size-5" strokeWidth={1.8} />
                  </div>
                  <p className="mt-5 text-sm font-semibold">Drop your bill photo here</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">or <span className="font-medium text-primary">browse files</span></p>
                  <p className="mt-5 text-[11px] text-muted-foreground">JPG, PNG or HEIC · up to 10 MB</p>
                </div>

                <div className="flex min-h-[280px] flex-col rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Selected bill</p>
                    {file && <Check className="size-4 text-primary" />}
                  </div>
                  <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/60">
                    {file ? (
                      <img src={URL.createObjectURL(file)} alt="Selected bill preview" className="h-full max-h-[210px] w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                        <FileImage className="size-7 opacity-50" strokeWidth={1.4} />
                        <p className="text-xs">Your preview will appear here</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="truncate text-xs text-muted-foreground">{file ? file.name : 'No image selected'}</p>
                    {file && <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Remove</button>}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
                <p className="max-w-[270px] text-xs leading-5 text-muted-foreground">We&apos;ll keep your bill private and only use it to read the details.</p>
                <button type="button" disabled={!file} className="group flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">
                  Extract Bill
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
