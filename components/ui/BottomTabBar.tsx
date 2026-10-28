'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Egg, Wallet, ShoppingCart, Building2, Menu, LogOut } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav-items'
import BottomSheet from './BottomSheet'

// Las 4 secciones de uso diario. El resto de NAV_ITEMS cae en "Más".
const TABS = [
  { href: '/produccion', label: 'Prod.', icon: Egg },
  { href: '/caja', label: 'Caja', icon: Wallet },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/galpones', label: 'Galp.', icon: Building2 },
]
const TAB_HREFS = new Set(TABS.map((t) => t.href))
const MAS_ITEMS = NAV_ITEMS.filter((i) => !TAB_HREFS.has(i.href))

// Navegación mobile/tablet (<1024px): reemplaza a la sidebar de escritorio.
export default function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [masAbierto, setMasAbierto] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const masActivo = MAS_ITEMS.some((i) => (i.href === '/' ? pathname === '/' : pathname.startsWith(i.href)))

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white flex items-stretch shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const activo = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                activo ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon size={22} />
              {tab.label}
            </Link>
          )
        })}
        <button
          onClick={() => setMasAbierto(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            masActivo ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <Menu size={22} />
          Más
        </button>
      </nav>

      <BottomSheet abierto={masAbierto} onClose={() => setMasAbierto(false)} titulo="Más secciones">
        <div className="space-y-1 pb-2">
          {MAS_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMasAbierto(false)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-slate-700 hover:bg-slate-50 text-base"
              >
                <Icon size={20} className="text-slate-400" />
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-red-600 hover:bg-red-50 text-base w-full"
          >
            <LogOut size={20} />
            Cerrar sesión
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
