# Granja Neimor — Guía de Setup

## 1. Instalar dependencias

```bash
cd /Users/joaquinmorra/Desktop/Granja_Neimor
npm install
```

---

## 2. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New project
2. Nombre: `granja-neimor`
3. Copiar las credenciales: **Project URL** y **anon key**

---

## 3. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Editar `.env.local` con tus datos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4. Ejecutar el schema en Supabase

En el **SQL Editor** de Supabase, ejecutar en orden:

### a) Schema (tablas, vistas, políticas)
```
supabase/migrations/001_initial.sql
```

### b) Datos iniciales
```
supabase/seed.sql
```

---

## 5. Crear usuario administrador

En Supabase → **Authentication** → **Users** → Add user:
- Email: tu email
- Password: tu contraseña
- ✅ Auto confirm user

---

## 6. Levantar el servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

---

## 7. Deploy en Vercel

```bash
# Instalar Vercel CLI (si no lo tenés)
npm i -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

O directamente desde [vercel.com](https://vercel.com) conectando el repo de GitHub.

---

## Estructura del proyecto

```
├── app/
│   ├── login/              # Página de login
│   ├── auth/callback/      # Callback de autenticación
│   └── (dashboard)/        # Todas las páginas autenticadas
│       ├── page.tsx         # Dashboard principal
│       ├── produccion/      # Módulo de producción
│       ├── ventas/          # Módulo de ventas
│       ├── caja/            # Módulo de caja
│       └── galpones/        # ABM de galpones y lotes
├── components/
│   ├── Sidebar.tsx          # Navegación lateral
│   ├── KPICard.tsx          # Tarjeta de KPI
│   ├── charts/              # Gráficos (Recharts)
│   ├── produccion/          # Componentes de producción
│   └── ventas/              # Componentes de ventas
├── lib/
│   ├── supabase/            # Clientes browser y server
│   └── utils.ts             # Utilidades (cálculos, formatos)
├── types/index.ts           # Tipos TypeScript
└── supabase/
    ├── migrations/001_initial.sql
    └── seed.sql
```

---

## Notas importantes

- La vista `gallinas_actuales` calcula automáticamente las muertes acumuladas y la edad en semanas
- El campo `monto_debe` en ventas debe cargarse manualmente cuando el estado es PARCIAL
- Para agregar nuevos usuarios: Supabase → Authentication → Users → Invite user
- El punto de equilibrio está en `lib/utils.ts` → `PUNTO_EQUILIBRIO_CAJONES = 66`
