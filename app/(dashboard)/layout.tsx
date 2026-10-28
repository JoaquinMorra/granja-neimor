import Sidebar from '@/components/Sidebar'
import BottomTabBar from '@/components/ui/BottomTabBar'
import ToastProvider from '@/components/ui/ToastProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-60 min-h-screen">
          {/* pb-24: deja lugar a la bottom tab bar (h-16) + el FAB, que viven
              fixed por debajo de 1024px. En desktop no hace falta. */}
          <div className="p-4 pb-24 lg:p-8">{children}</div>
        </main>
        <BottomTabBar />
      </div>
    </ToastProvider>
  )
}
