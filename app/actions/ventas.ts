'use server'

import { dbAdmin, schema } from '@/lib/db'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireTenant } from '@/lib/leads/server-helpers'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'

// ── getVentas ─────────────────────────────────────────────────────────────────
// Registro de ventas scopeado por rol. Fuente de verdad de las ventas (incluye
// monto, datos del comprador y el usado tomado en parte de pago).
//   dueño/admin → todas las del tenant
//   gerente     → ventas de leads de sus equipos
//   supervisor  → ventas de leads de su equipo
//   vendedor    → solo las que registró
// El alcance se aplica server-side; el cliente filtra por período/búsqueda.

export async function getVentas() {
  const { user, tenantId } = await requireTenant()
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)

  const FIELDS = {
    id:               schema.registroVentas.id,
    lead_id:          schema.registroVentas.lead_id,
    modelo:           schema.registroVentas.modelo,
    monto:            schema.registroVentas.monto,
    vendida_at:       schema.registroVentas.vendida_at,
    vendedor_id:      schema.registroVentas.vendedor_id,
    comprador_telefono:     schema.registroVentas.comprador_telefono,
    comprador_telefono_alt: schema.registroVentas.comprador_telefono_alt,
    comprador_dni:          schema.registroVentas.comprador_dni,
    comprador_email:        schema.registroVentas.comprador_email,
    cliente:          schema.leads.nombre,
    source:           schema.leads.source,
    source_custom:    schema.leads.source_custom,
    provincia:        schema.leads.provincia,
    equipo_id:        schema.leads.equipo_id,
    vendedor_nombre:  schema.usuarios.nombre,
    vendedor_alias:   schema.usuarios.alias,
    usado_marca:      schema.cotizaciones.marca_modelo,
    usado_valor:      schema.cotizaciones.valor_final,
  }

  const base = dbAdmin
    .select(FIELDS)
    .from(schema.registroVentas)
    .leftJoin(schema.leads,        eq(schema.registroVentas.lead_id, schema.leads.id))
    .leftJoin(schema.usuarios,     eq(schema.registroVentas.vendedor_id, schema.usuarios.id))
    .leftJoin(schema.cotizaciones, eq(schema.registroVentas.usado_tomado_id, schema.cotizaciones.id))

  const orderBy = desc(schema.registroVentas.vendida_at)
  const tenantCond = eq(schema.registroVentas.tenant_id, tenantId)

  switch (scope.type) {
    case 'all':
      return base.where(tenantCond).orderBy(orderBy).limit(500)

    case 'teams':
      if (scope.equipoIds.length === 0) return []
      return base
        .where(and(tenantCond, inArray(schema.leads.equipo_id, scope.equipoIds)))
        .orderBy(orderBy).limit(500)

    case 'team':
      return base
        .where(and(tenantCond, eq(schema.leads.equipo_id, scope.equipoId)))
        .orderBy(orderBy).limit(500)

    case 'self':
      return base
        .where(and(tenantCond, eq(schema.registroVentas.vendedor_id, user.id)))
        .orderBy(orderBy).limit(500)

    case 'none':
    default:
      return []
  }
}
