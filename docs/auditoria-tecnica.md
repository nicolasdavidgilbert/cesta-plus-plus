# Auditoria tecnica de Cesta++ (InsForge/Postgres)

## Resumen rapido
La auditoria ya no es una tabla "normal" unica. Ahora es una tabla **particionada por mes**.

Esto significa:
- Puedes guardar muchos mas eventos sin que todo se vuelva lento tan rapido.
- Las consultas por fechas son mas eficientes.
- Es mas facil aplicar retencion en el futuro.

## Que se guarda en cada evento
Tabla principal: `public.user_activity_events`

Campos importantes:
- `id`: identificador del evento.
- `created_at`: cuando ocurrio el evento de negocio.
- `ingested_at`: cuando se inserto en auditoria.
- `event_type`: tipo de evento (ej: `list_item_checked`).
- `actor_user_id`: quien hizo la accion.
- `list_id`, `item_id`, `product_id`, `price_history_id`, etc: entidades afectadas.
- `old_data` / `new_data`: antes y despues (cuando aplica).
- `metadata`: datos extra para analitica.
- `event_version`: version del formato del evento.

## Como se generan los eventos
Los eventos se crean automaticamente desde **triggers** en tablas de negocio:
- `shopping_list_items`
- `products`
- `price_history`
- `shopping_lists`
- `list_shares`
- `list_invite_links`

Cada trigger llama a `public.record_user_activity(...)`.

## Mejora aplicada en la funcion de auditoria
`record_user_activity(...)` ahora enriquece `metadata` con:
- `audit_version`
- `txid` (id de transaccion en Postgres)
- `captured_at`
- `actor_user_id`

Esto es util para trazabilidad y depuracion futura.

## Escalabilidad: particiones
Se usa particion por rango de `created_at` (mensual), por ejemplo:
- `user_activity_events_2026_04`
- `user_activity_events_2026_05`
- etc.

Tambien existe:
- `user_activity_events_default` (fallback)

### Cambio de año (diciembre -> enero)
- El esquema usa `YYYY_MM`, asi que al pasar de `2026_12` a `2027_01` no hay problema.
- El cron mensual sigue creando/verificando particiones futuras aunque cambie el año.
- Si por cualquier razon faltara la particion del mes, el evento cae en `user_activity_events_default` (no se pierde dato).
- En la configuracion actual no hay borrado automatico de historico (`retention = NULL`).

## Mantenimiento automatico
Hay una funcion:
- `public.maintain_user_activity_partitions(...)`

Y un cron mensual que la ejecuta:
- horario: `0 3 1 * *`
- crea/verifica particiones para meses cercanos.

## Consultas mas rapidas
Se crearon indices para patrones comunes:
- por fecha (`created_at`)
- por tipo+fecha (`event_type, created_at`)
- por actor+fecha
- por lista+fecha
- por producto+fecha
- GIN sobre `metadata` para filtros en JSON

## Seguridad (RLS)
En `user_activity_events`:
- Usuario ve sus propios eventos (`actor_user_id = requesting_user_id()`).
- Usuario ve eventos de listas/productos a los que tiene acceso.
- `project_admin` tiene acceso total.

## Vista enriquecida para analitica
Vista: `public.user_activity_events_enriched`

Anade columnas derivadas:
- `event_day`
- `event_month`
- `list_name`
- `product_title`

Sirve para dashboards y reportes sin repetir joins.

## Script de migracion
Archivo:
- `sql/improve-activity-audit.sql`

Que hace:
1. Migra la tabla vieja a nueva particionada.
2. Conserva datos historicos.
3. Crea indices, politicas y funciones.
4. Crea/actualiza vista enriquecida.
5. Deja mantenimiento automatico con cron.

## Por que este diseno
Objetivo: auditoria "full" hoy, pero sin bloquear crecimiento manana.

Este diseno equilibra:
- **Trazabilidad**: guardas eventos de cambios relevantes.
- **Rendimiento**: particiones + indices.
- **Analitica futura**: metadata versionada + vista enriquecida.
- **Seguridad**: RLS alineada con permisos de negocio.
