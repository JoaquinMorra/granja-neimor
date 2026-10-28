import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Granja Neimor',
  description: 'Sistema de gestión para granja de gallinas ponedoras',
  // Al agregar el sistema a la pantalla de inicio del iPhone, se abre como
  // app (sin la barra de Safari). No convierte nada a PWA — son solo los
  // meta tags que ya sabe interpretar iOS. El ícono sale de app/apple-icon.tsx.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Granja Neimor',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
