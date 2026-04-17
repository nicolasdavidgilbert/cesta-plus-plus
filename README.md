# Cesta++ (Next.js + InsForge)

Aplicacion para gestionar listas de compra colaborativas con:
- autenticacion por email/OAuth
- catalogo de productos con historial de precios
- comparticion de listas en tiempo real
- auditoria de actividad preparada para analitica futura

## Para que sirve
Cesta++ resuelve 3 cosas:
1. Organizar compras por listas y productos.
2. Colaborar entre varios usuarios en una misma lista.
3. Guardar trazabilidad de cambios (auditoria) para explotar datos despues.

## Como funciona (alto nivel)
1. El usuario se registra/inicia sesion.
2. Crea listas en `/dashboard`.
3. Entra en una lista (`/dashboard/[id]`) y agrega productos/cantidades.
4. Los cambios se sincronizan por Realtime (`list:*`, `user:*:lists`).
5. Los cambios de negocio disparan eventos de auditoria en DB.

## Rutas principales
- `/` landing
- `/sign-in` login
- `/sign-up` registro + verificacion por codigo
- `/dashboard` listas propias/compartidas
- `/dashboard/[id]` detalle de lista colaborativa
- `/products` catalogo de productos + historial de precios
- `/invite/[token]` aceptacion de invitaciones
- `/dashboard/profile` perfil de usuario

## Stack tecnico
- Next.js `16.2.3` (App Router)
- React `19.2.4`
- `@insforge/sdk` para auth, database y realtime
- Tailwind CSS `4`

## Datos y modelos (DB)
### Dominio principal
- `shopping_lists`
- `shopping_list_items`
- `products`
- `price_history`
- `list_shares`
- `list_invite_links`

### Auth
- usuarios en `auth.users` (no en `public`)

### Auditoria
- `public.user_activity_events` (particionada por mes)
- `public.user_activity_events_enriched` (vista para analitica)

Detalle tecnico completo:
- [auditoria-tecnica.md](docs/auditoria-tecnica.md)

## Variables de entorno
Crea `.env.local`:

```bash
NEXT_PUBLIC_INSFORGE_URL=https://<tu-app>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<tu-anon-key>
```

Opcionales recomendadas para redirects absolutos de auth:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# o
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Puesta en marcha (local)
1. Instalar dependencias:
```bash
pnpm install
```

2. Levantar en desarrollo:
```bash
pnpm dev
```

3. Abrir:
`http://localhost:3000`

## Scripts (pnpm)
- `pnpm dev` desarrollo
- `pnpm build` build produccion
- `pnpm start` ejecutar build
- `pnpm lint` lint del proyecto

## Bootstrap y migraciones SQL
Scripts disponibles en `sql/`:
- `list-sharing-realtime.sql` setup principal de comparticion + realtime + auditoria base
- `fix-products-rls.sql` hardening de RLS en productos/precios
- `improve-activity-audit.sql` mejora de auditoria (particiones, indices, mantenimiento)

Ejemplo de ejecucion:

```bash
pnpm dlx @insforge/cli db query -- "$(cat sql/list-sharing-realtime.sql)"
pnpm dlx @insforge/cli db query -- "$(cat sql/fix-products-rls.sql)"
pnpm dlx @insforge/cli db query -- "$(cat sql/improve-activity-audit.sql)"
```

## Realtime y colaboracion
La app publica y escucha eventos para refrescar vistas de listas:
- canal de lista: `list:<listId>`
- canal de panel: `user:<userId>:lists`

Esto permite que cambios de un usuario se reflejen en otros clientes conectados.

## Notas operativas
- `redirectTo` en auth debe ser URL absoluta.
- La auditoria actualmente no borra historico automaticamente (retencion desactivada).
- Si falta una particion mensual de auditoria, existe particion `default` como fallback.
