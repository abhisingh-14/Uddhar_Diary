import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { label: 'Profile', path: '/settings/profile' },
  { label: 'Security', path: '/settings/security' },
  { label: 'People & contacts', path: '/settings/people' },
]

export default function SettingsPage() {
  return (
    <div className="flex flex-1 items-start justify-center px-5 py-6 md:px-12 md:py-10 lg:py-16">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <div className="max-w-[500px]">
          <h2 className="font-headline text-balance text-3xl font-semibold tracking-[-0.045em] text-on-surface md:text-[40px] md:leading-[1.05]">
            Settings
          </h2>
          <p className="mt-4 max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">
            Manage your profile, security, and the people you track.
          </p>
        </div>

        <nav aria-label="Settings sections" className="mt-8 flex gap-1.5 overflow-x-auto">
          {tabs.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex min-w-fit items-center rounded-xl px-4 py-2 font-body text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-md'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
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
