import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { label: 'Profile', path: '/settings/profile' },
  { label: 'Security', path: '/settings/security' },
  { label: 'People & contacts', path: '/settings/people' },
]

export default function SettingsPage() {
  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <div className="max-w-[500px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Settings
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
            Settings
          </h2>
          <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
            Manage your profile, security, and the people you track.
          </p>
        </div>

        <nav aria-label="Settings sections" className="mt-8 flex gap-1.5 overflow-x-auto">
          {tabs.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex min-w-fit items-center rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  )
}
