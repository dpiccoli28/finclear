# FinClear · Sistema de Conciliaciones Contables
## Legacy Luxury Limo Corp · Optimizado para Netlify

---

## PASO 1 — Supabase (5 minutos)

1. Ve a **https://supabase.com** → entra a tu proyecto
2. Panel izquierdo → **SQL Editor** → New query
3. Copia y pega el contenido de `supabase/migrations/001_schema.sql`
4. Clic en **Run** (botón verde)
5. Ve a **Project Settings → API** y copia:
   - **Project URL** → algo como `https://abcxyz.supabase.co`
   - **anon public key** → clave larga que empieza con `eyJ...`

---

## PASO 2 — GitHub (5 minutos)

1. Ve a **https://github.com** → Sign in
2. Clic en **+** → **New repository**
3. Nombre: `finclear` → **Create repository**
4. Descomprime el ZIP que descargaste
5. Arrastra **todos los archivos** al repositorio en GitHub (drag & drop en la página)
6. Clic en **Commit changes**

---

## PASO 3 — Netlify (5 minutos)

1. Ve a **https://app.netlify.com** → entra con tu cuenta
2. Clic en **Add new site → Import an existing project**
3. Selecciona **GitHub** → elige el repositorio `finclear`
4. En la configuración del build:
   - **Build command:** `npm run build`
   - **Publish directory:** `out`
5. Clic en **Add environment variables** y agrega:
   ```
   NEXT_PUBLIC_SUPABASE_URL      = https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...tu-clave...
   ```
6. Clic en **Deploy site**
7. En ~3 minutos tienes una URL tipo `finclear-abc123.netlify.app`

> Puedes cambiar el nombre del sitio en: Site settings → Change site name

---

## Ya en la nube ✓

- Accesible desde cualquier navegador o celular
- El PDF se procesa directamente en el navegador (privacidad total)
- Base de datos en Supabase (gratis hasta 500MB)
- Deploy automático cada vez que actualices el código en GitHub

---

## Plan de cuentas cargado

```
1.1.01.01  Citibank N.A.                    Activo · Banco
4.1.01.01  Serv. transporte (Uber)          Ingreso
4.1.01.02  Serv. transporte (Lyft)          Ingreso
4.1.01.03  Serv. transporte (Terceros)      Ingreso
4.1.01.04  Serv. transporte (Propios)       Ingreso
5.1.01.01  Combustible                      Costo directo
5.1.01.02  EZ Pass y Peajes                 Costo directo
5.1.01.03  Carwash                          Costo directo
6.1.01.01  Sueldos directivos               Gasto operativo
6.1.01.02  Sueldos administrativos          Gasto operativo
6.1.01.06  Comisiones bancarias             Gasto operativo
2.1.01.01  Impuestos por pagar              Impuesto
6.1.01.90  Gasto no deducible (registro)    No deducible
```

---

## Módulos

| Módulo | Función |
|--------|---------|
| Dashboard | KPIs, alertas de pendientes, últimos asientos |
| Subir extracto | PDF Citibank → auto-clasificación en el navegador |
| Conciliar | Clasificar, confirmar asientos, reporte PDF pendientes |
| Libro diario | Todos los asientos Debe/Haber, exportar Excel |
| Libro mayor | Saldo por cuenta |
| Plan de cuentas | Gestión de cuentas con palabras clave automáticas |
| Estado de resultados | P&L automático, exportar PDF profesional |
