'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatearFechaCorta } from '@/lib/utils'

type ProduccionSemanalData = {
  fecha: string
  coloradas: number
  blancas: number
}

type VentasMensualesData = {
  mes: string
  cajones: number
}

type PosturaData = {
  galpon: string
  real: number
  min: number
  max: number
}

export function ProduccionSemanalChart({ data }: { data: ProduccionSemanalData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    fecha: formatearFechaCorta(d.fecha),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => [value.toLocaleString('es-AR') + ' huevos']}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="coloradas"
          name="Coloradas"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="blancas"
          name="Blancas"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function VentasMensualesChart({ data }: { data: VentasMensualesData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => [value.toFixed(1) + ' cajones']}
          labelStyle={{ fontWeight: 600 }}
        />
        <ReferenceLine y={66} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'P.E. 66', fill: '#ef4444', fontSize: 11 }} />
        <Bar dataKey="cajones" name="Cajones vendidos" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PosturaGalponesChart({ data }: { data: PosturaData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <YAxis type="category" dataKey="galpon" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => [value.toFixed(1) + '%']}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="real" name="Postura real" fill="#22c55e" radius={[0, 4, 4, 0]} />
        <Bar dataKey="min" name="Esperado mín" fill="#bfdbfe" radius={[0, 4, 4, 0]} />
        <Bar dataKey="max" name="Esperado máx" fill="#93c5fd" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
