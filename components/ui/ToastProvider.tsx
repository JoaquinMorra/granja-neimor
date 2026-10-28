'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

type ToastTipo = 'ok' | 'error'
type ToastItem = { id: number; mensaje: string; tipo: ToastTipo }
type ToastContextType = { toast: (mensaje: string, tipo?: ToastTipo) => void }

const ToastContext = createContext<ToastContextType | null>(null)

// No había ninguna librería de toasts en el proyecto (ni sonner ni similar),
// así que es casero: un contexto + un contenedor fijo que se monta una sola
// vez en el layout del dashboard.
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx.toast
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((mensaje: string, tipo: ToastTipo = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, mensaje, tipo }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 px-4 w-full sm:w-auto pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-sm ${
              t.tipo === 'ok' ? 'bg-slate-900' : 'bg-red-600'
            }`}
          >
            {t.tipo === 'ok'
              ? <CheckCircle size={18} className="text-green-400 shrink-0" />
              : <XCircle size={18} className="shrink-0" />}
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
