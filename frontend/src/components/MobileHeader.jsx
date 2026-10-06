import Logo from './Logo.jsx'

export default function MobileHeader() {
  return (
    <header className="flex md:hidden items-center gap-3 px-5 py-4 border-b border-border bg-sidebar">
      <Logo size={32} />
      <div>
        <p className="font-sans text-[15px] font-semibold tracking-tight">Uddhar Diary</p>
        <p className="text-[11px] text-muted-foreground">Make every rupee count</p>
      </div>
    </header>
  )
}
