'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Listas' },
  { href: '/products', label: 'Productos' },
  { href: '/dashboard/profile', label: 'Perfil' },
]

export default function MobileDashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl gap-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/dashboard' && pathname.startsWith('/dashboard/') && pathname !== '/dashboard/profile')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex flex-1 items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
