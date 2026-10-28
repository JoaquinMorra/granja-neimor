import {
  LayoutDashboard,
  Egg,
  ShoppingCart,
  Wallet,
  Building2,
  Truck,
  Package,
  Store,
  Archive,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon }

// Fuente única de las secciones del sistema — la usan tanto la sidebar de
// escritorio como el bottom sheet "Más" de la navegación mobile.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/produccion', label: 'Producción', icon: Egg },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/caja', label: 'Caja', icon: Wallet },
  { href: '/galpones', label: 'Galpones', icon: Building2 },
  { href: '/proveedores', label: 'Proveedores', icon: Truck },
  { href: '/productos', label: 'Productos', icon: Package },
  // Costos: oculto a pedido de Joaco — ver nota en components/Sidebar.tsx
  { href: '/mercado', label: 'Mercado', icon: Store },
  { href: '/cierres', label: 'Cierres de Mes', icon: Archive },
]
