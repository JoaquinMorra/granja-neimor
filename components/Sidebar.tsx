'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav-items'

// Navegación de escritorio (≥1024px / `lg:`). Por debajo de ese ancho la
// navegación es la bottom tab bar (components/ui/BottomTabBar.tsx).
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-slate-900 fixed inset-y-0 left-0 z-30">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm">
              GN
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Granja Neimor</p>
              <p className="text-slate-400 text-xs">Gestión de producción</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}
