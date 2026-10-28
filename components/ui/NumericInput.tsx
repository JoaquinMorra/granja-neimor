'use client'

import { forwardRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  decimal?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>

// Input numérico tamaño mobile: alto y letra grandes, teclado numérico
// correcto en iOS. `ref` se expone para encadenar el foco al siguiente
// campo al tocar "Siguiente" en el teclado.
const NumericInput = forwardRef<HTMLInputElement, Props>(function NumericInput(
  { value, onChange, decimal = false, className = '', placeholder = '0', ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern="[0-9]*"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-4 text-xl font-bold text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${className}`}
      {...rest}
    />
  )
})

export default NumericInput
