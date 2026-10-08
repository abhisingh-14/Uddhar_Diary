import Logo from './Logo'

export default function MobileAuthHeader() {
  return (
    <div className="lg:hidden relative flex flex-col items-center text-center pt-2 pb-6">
      {/* Ambient soft emerald aura */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-44 pointer-events-none rounded-full opacity-40 blur-3xl bg-primary-container/20" />
      
      {/* Logo */}
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container-high shadow-md mb-3 relative z-10">
        <Logo size={28} />
      </div>
      
      {/* Brand name and tagline */}
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile tracking-tight text-on-surface flex items-center justify-center gap-1.5 relative z-10">
        <span>Uddhar</span>
        <span className="text-primary font-bold">Diary</span>
      </h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[260px] mt-1 text-center relative z-10">
        Split the bill. Never lose track of who owes what.
      </p>
    </div>
  )
}
