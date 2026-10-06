import { NavLink } from 'react-router-dom'
import { navItems } from './Navbar.jsx'

export default function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex md:hidden border-t border-border bg-sidebar z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {navItems.map(({ label, shortLabel, icon: Icon, path }) => (
        <NavLink
          key={path}
          to={path}
          end={false}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center min-h-[44px] py-2 transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`
          }
        >
          <Icon className="size-6" strokeWidth={1.8} />
          <span className="mt-1 text-[11px] font-medium">{shortLabel}</span>
        </NavLink>
      ))}
    </nav>
  )
}
