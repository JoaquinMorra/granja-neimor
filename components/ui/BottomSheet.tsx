'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type Props = {
  abierto: boolean
  onClose: () => void
  titulo?: string
  children: React.ReactNode
}

// Modal que se desliza desde abajo, hecho a mano (sin librería) para no
// sumar una dependencia nueva al proyecto. Se cierra tocando el fondo, el
// botón X, o deslizando la hoja hacia abajo con el dedo.
export default function BottomSheet({ abierto, onClose, titulo, children }: Props) {
  const [arrastreY, setArrastreY] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const startY = useRef(0)

  useEffect(() => {
    if (!abierto) {
      setArrastreY(0)
      return
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [abierto])

  if (!abierto) return null

  function handleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
    setArrastrando(true)
  }
  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setArrastreY(delta)
  }
  function handleTouchEnd() {
    setArrastrando(false)
    if (arrastreY > 100) onClose()
    setArrastreY(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{
          transform: `translateY(${arrastreY}px)`,
          transition: arrastrando ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>
        {titulo && (
          <div className="flex items-center justify-between px-5 pb-3 pt-2 shrink-0 border-b border-slate-100 sm:pt-5">
            <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 -mr-1">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-6 pt-3 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
