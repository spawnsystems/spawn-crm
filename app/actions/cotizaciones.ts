'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { requireTenant, assertLeadAccess, appendTimeline, cancelPendingCalls, cancelActiveCita } from '@/lib/leads/server-helpers'
import { calcularUsado, condicionesComerciales } from '@/lib/cotizador/calc'
import { logAudit } from '@/lib/audit/log'
import type { ActionResult } from './auth'
import { z } from 'zod'

// ── Schemas ───────────────────────────────────────────────────────────────────

const createCotizacionSchema = z.object({
  lead_id:      z.string().uuid().optional(),
  marca_modelo: z.string().max(150).optional(),
  anio:         z.number().int().min(1900).max(new Date().getFullYear() + 1),
  km:           z.number().int().min(0),
  uso:          z.enum(['particular', 'taxi_uber_transporte']),
  base_infoauto: z.number().positive('El valor InfoAuto debe ser mayor a 0'),
  provincia:    z.string().optional(),
})

const updateCotizacionSchema = z.object({
  id:           z.string().uuid(),
  marca_modelo: z.string().max(150).optional(),
  anio:         z.number().int().min(1900).max(new Date().getFullYear() + 1),
  km:           z.number().int().min(0),
  uso:          z.enum(['particular', 'taxi_uber_transporte']),
  base_infoauto: z.number().positive('El valor InfoAuto debe ser mayor a 0'),
  provincia:    z.string().optional(),
})

const registrarVentaSchema = z.object({
  lead_id:         z.string().uuid().optional(),
  modelo:          z.string().optional(),
  monto:           z.number().positive().optional(),
  usado_tomado_id: z.string().uuid().optional(),
})

// ── createCotizacion ──────────────────────────────────────────────────────────

export async function createCotizacion(input: unknown): Promise<ActionResult<{ id: string; result: ReturnType<typeof calcularUsado> }>> {
  const { user, tenantId, q } = await requireTenant()

  const parsed = createCotizacionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  // Si la cotización se vincula a un lead, verificar acceso al lead
  if (data.lead_id) {
    const lead = await assertLeadAccess(data.lead_id, user.id, user.rol, tenantId)
    if (!lead) return { success: false, error: 'No tenés acceso a este lead' }
  }

  const result = calcularUsado({
    baseInfoauto: data.base_infoauto,
    km:           data.km,
    anio:         data.anio,
    uso:          data.uso,
    provincia:    data.provincia,
  })

  const [row] = await q.insert(schema.cotizaciones).values({
    tenant_id:       tenantId,
    lead_id:         data.lead_id ?? null,
    marca_modelo:    data.marca_modelo ?? null,
    anio:            data.anio,
    km:              data.km,
    uso:             data.uso,
    base_infoauto:   data.base_infoauto.toString(),
    descuento_pct:   result.descuentoPct.toString(),
    valor_calculado: result.valorCalculado.toString(),
    override_valor:  null,
    valor_final:     result.valorCalculado.toString(),
    rechazado:       result.rechazado,
    rechazo_motivo:  result.rechazoMotivo ?? null,
    condiciones:     result.condiciones,
    created_by:      user.id,
  }).returning({ id: schema.cotizaciones.id })

  // Si se asoció a un lead, marcarlo como "tiene usado" (la cotización es la
  // verdad: aunque al crear el lead se haya dicho que no, ahora sí tiene) y
  // dejar registro en el historial del lead + auditoría.
  if (data.lead_id) {
    await dbAdmin
      .update(schema.leads)
      .set({ tiene_usado: true, updated_by: user.id })
      .where(and(eq(schema.leads.id, data.lead_id), eq(schema.leads.tenant_id, tenantId)))

    const desc = result.rechazado
      ? (result.rechazoMotivo ?? 'Usado rechazado')
      : `${data.marca_modelo ?? 'Usado'} — valor de toma $${result.valorCalculado.toLocaleString('es-AR')}`
    await appendTimeline(
      tenantId, data.lead_id, user.id,
      'cotizacion_created',
      result.rechazado ? 'Usado cotizado — rechazado' : 'Usado cotizado',
      desc,
    )

    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'cotizacion.create',
      entity:         'cotizacion',
      entityId:       row.id,
      meta: {
        lead_id:      data.lead_id,
        marca_modelo: data.marca_modelo,
        anio:         data.anio,
        km:           data.km,
        uso:          data.uso,
        valor_final:  result.valorCalculado,
        rechazado:    result.rechazado,
      },
      visibleToDueno: true,
    })
  }

  revalidatePath('/cotizador')
  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: { id: row.id, result } }
}

// ── updateCotizacion ──────────────────────────────────────────────────────────
// Modifica una cotización existente en lugar de crear otra (editar el mismo auto).

export async function updateCotizacion(input: unknown): Promise<ActionResult<{ result: ReturnType<typeof calcularUsado> }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = updateCotizacionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  // Cargar la cotización y validar tenant + acceso al lead
  const rows = await dbAdmin
    .select()
    .from(schema.cotizaciones)
    .where(and(eq(schema.cotizaciones.id, data.id), eq(schema.cotizaciones.tenant_id, tenantId)))
    .limit(1)
  const cot = rows[0]
  if (!cot) return { success: false, error: 'Cotización no encontrada' }
  if (cot.lead_id) {
    const lead = await assertLeadAccess(cot.lead_id, user.id, user.rol, tenantId)
    if (!lead) return { success: false, error: 'No tenés acceso a este lead' }
  }

  const result = calcularUsado({
    baseInfoauto: data.base_infoauto,
    km:           data.km,
    anio:         data.anio,
    uso:          data.uso,
    provincia:    data.provincia,
  })

  await dbAdmin
    .update(schema.cotizaciones)
    .set({
      marca_modelo:    data.marca_modelo ?? null,
      anio:            data.anio,
      km:              data.km,
      uso:             data.uso,
      base_infoauto:   data.base_infoauto.toString(),
      descuento_pct:   result.descuentoPct.toString(),
      valor_calculado: result.valorCalculado.toString(),
      valor_final:     result.valorCalculado.toString(),
      rechazado:       result.rechazado,
      rechazo_motivo:  result.rechazoMotivo ?? null,
      condiciones:     result.condiciones,
      updated_at:      new Date(),
    })
    .where(eq(schema.cotizaciones.id, data.id))

  // Historial del lead + auditoría del cambio
  if (cot.lead_id) {
    const desc = result.rechazado
      ? (result.rechazoMotivo ?? 'Usado rechazado')
      : `${data.marca_modelo ?? 'Usado'} — nuevo valor de toma $${result.valorCalculado.toLocaleString('es-AR')}`
    await appendTimeline(
      cot.tenant_id, cot.lead_id, user.id,
      'cotizacion_updated',
      result.rechazado ? 'Cotización actualizada — rechazado' : 'Cotización actualizada',
      desc,
    )

    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'cotizacion.update',
      entity:         'cotizacion',
      entityId:       data.id,
      meta: {
        lead_id:          cot.lead_id,
        marca_modelo:     data.marca_modelo,
        anio:             data.anio,
        km:               data.km,
        uso:              data.uso,
        valor_final_prev: cot.valor_final,
        valor_final:      result.valorCalculado,
        rechazado:        result.rechazado,
      },
      visibleToDueno: true,
    })
  }

  revalidatePath('/cotizador')
  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: { result } }
}

// ── getCotizacionesForLead ────────────────────────────────────────────────────

export async function getCotizacionesForLead(leadId: string) {
  const { user, tenantId } = await requireTenant()

  // Scope: solo si el usuario tiene acceso al lead (no solo al tenant)
  const lead = await assertLeadAccess(leadId, user.id, user.rol, tenantId)
  if (!lead) return []

  return dbAdmin
    .select()
    .from(schema.cotizaciones)
    .where(
      and(
        eq(schema.cotizaciones.tenant_id, tenantId),
        eq(schema.cotizaciones.lead_id, leadId),
      ),
    )
    .orderBy(desc(schema.cotizaciones.created_at))
}

// ── registrarVenta ────────────────────────────────────────────────────────────

export async function registrarVenta(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const parsed = registrarVentaSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  // Si la venta se vincula a un lead, es la ÚNICA vía para marcarlo VENTA y
  // exige que el lead esté en CIERRE (no se vende algo que no pasó por el embudo).
  if (data.lead_id) {
    const lead = await assertLeadAccess(data.lead_id, user.id, user.rol, tenantId)
    if (!lead) return { success: false, error: 'No tenés acceso a este lead' }

    if (lead.status === 'VENTA') {
      return { success: false, error: 'Este lead ya figura como vendido.' }
    }
    if (lead.status !== 'CIERRE') {
      return {
        success: false,
        error:   'Para registrar la venta el lead tiene que estar en CIERRE. Avanzá la cita y el cierre primero.',
      }
    }
  }

  const [row] = await q.insert(schema.registroVentas).values({
    tenant_id:       tenantId,
    lead_id:         data.lead_id ?? null,
    vendedor_id:     user.id,
    modelo:          data.modelo ?? null,
    monto:           data.monto?.toString() ?? null,
    usado_tomado_id: data.usado_tomado_id ?? null,
  }).returning({ id: schema.registroVentas.id })

  // Marcar el lead como VENTA (terminal positivo) + timeline + audit.
  if (data.lead_id) {
    await q.update(schema.leads)
      .set({ status: 'VENTA', abandoned_at: null, updated_by: user.id })
      .where(and(eq(schema.leads.id, data.lead_id), forTenant(schema.leads)))

    // Cancelar llamadas pendientes y cita activa: la venta cierra el ciclo,
    // no tiene sentido que queden en el aire.
    void cancelPendingCalls(tenantId, data.lead_id, user.id)
    void cancelActiveCita(tenantId, data.lead_id, user.id)

    await appendTimeline(
      tenantId, data.lead_id, user.id,
      'closed_won',
      '¡Venta concretada! Trato confirmado',
    )

    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'venta.registrar',
      entity:         'lead',
      entityId:       data.lead_id,
      meta:           { modelo: data.modelo, monto: data.monto, registro_id: row.id },
      visibleToDueno: true,
    })
  }

  revalidatePath('/cotizador')
  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  return { success: true, data: { id: row.id } }
}

// ── getRegistroVentas ─────────────────────────────────────────────────────────

export async function getRegistroVentas() {
  const { user, tenantId } = await requireTenant()

  return dbAdmin
    .select({
      id:         schema.registroVentas.id,
      lead_id:    schema.registroVentas.lead_id,
      modelo:     schema.registroVentas.modelo,
      monto:      schema.registroVentas.monto,
      vendida_at: schema.registroVentas.vendida_at,
      nombre:     schema.leads.nombre,
      vendedor_nombre: schema.usuarios.nombre,
      vendedor_alias:  schema.usuarios.alias,
    })
    .from(schema.registroVentas)
    .leftJoin(schema.leads,    eq(schema.registroVentas.lead_id,    schema.leads.id))
    .leftJoin(schema.usuarios, eq(schema.registroVentas.vendedor_id, schema.usuarios.id))
    .where(eq(schema.registroVentas.tenant_id, tenantId))
    .orderBy(desc(schema.registroVentas.vendida_at))
    .limit(200)
}
