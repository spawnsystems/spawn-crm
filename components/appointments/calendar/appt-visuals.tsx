'use client'

import { cn, toBADate } from '@/lib/utils'
import { APPOINTMENT_TIPO_LABEL, APPOINTMENT_STATUS_LABEL } from '@/lib/schemas/appointments'
import { MapPin, Handshake } from 'lucide-react'
import {
  type ApptRow, TIPO_STYLE, fmtHM, formatApptRange, isApptPast, isApptDone,
} from './shared'

// Nombres mostrados
export function vendedorName(a: ApptRow): string {
  return a.vendedor_alias || a.vendedor_nombre || '—'
}
export function clienteName(a: ApptRow): string {
  return a.lead_nombre || 'Lead'
}

// ── Chip compacto (vista Mes) ─────────────────────────────────────

export function ApptChip({ appt, onClick }: { appt: ApptRow; onClick: () => void }) {
  const st       = TIPO_STYLE[appt.tipo]
  const start    = toBADate(appt.scheduled_at)
  const done     = isApptDone(appt)   // realizada / no_se_presento / cancelada / reagendada
  const past     = isApptPast(appt)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={`${formatApptRange(appt.scheduled_at, appt.duration_min)} · ${APPOINTMENT_TIPO_LABEL[appt.tipo]} · ${vendedorName(appt)} 🤝 ${clienteName(appt)}`}
      className={cn(
        'w-full flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium border truncate transition-opacity',
        done
          ? 'bg-muted/60 text-muted-foreground border-border opacity-60 line-through'
          : st.chip,
        !done && past && 'ring-1 ring-amber-400',
      )}
    >
      {!st.emphasis && <span className={cn('size-1.5 rounded-full shrink-0', done ? 'bg-muted-foreground/40' : st.dot)} />}
      <span className="tabular-nums shrink-0">{fmtHM(start)}</span>
      <span className="truncate">{clienteName(appt)}</span>
    </button>
  )
}

// ── Bloque grande (grilla Semana/Día) ─────────────────────────────
// `compact` = poca altura (cita corta): solo una línea.

export function ApptBlock({
  appt, onClick, compact,
}: {
  appt:    ApptRow
  onClick: () => void
  compact: boolean
}) {
  const st     = TIPO_STYLE[appt.tipo]
  const done   = isApptDone(appt)
  const past   = isApptPast(appt)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'h-full w-full overflow-hidden rounded-md border px-1.5 py-1 text-left transition-shadow hover:shadow-md',
        done
          ? 'bg-muted/60 text-muted-foreground border-border opacity-60 line-through'
          : st.block,
        !done && past && 'ring-1 ring-amber-400',
      )}
    >
      <div className={cn('text-[10px] font-semibold leading-tight tabular-nums',
        done ? 'opacity-80' : st.emphasis ? 'text-white/90' : 'opacity-80')}>
        {formatApptRange(appt.scheduled_at, appt.duration_min)}
      </div>
      {!compact && (
        <div className="text-[11px] font-semibold leading-tight truncate flex items-center gap-1 mt-0.5">
          <span className="truncate">{clienteName(appt)}</span>
        </div>
      )}
      {!compact && (
        <div className={cn('text-[10px] leading-tight truncate',
          done ? 'opacity-70' : st.emphasis ? 'text-white/80' : 'opacity-70')}>
          {APPOINTMENT_TIPO_LABEL[appt.tipo]} · {vendedorName(appt)}
        </div>
      )}
    </button>
  )
}

// ── Card rica (popover del día / listas) ──────────────────────────
// El cuerpo pedido: "[vendedor] 🤝 [cliente]" + tipo destacado + horario.

export function ApptCard({ appt, onClick }: { appt: ApptRow; onClick: () => void }) {
  const st     = TIPO_STYLE[appt.tipo]
  const done   = isApptDone(appt)
  const past   = isApptPast(appt)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border bg-card p-3 border-l-4 transition-shadow hover:shadow-md',
        done ? 'border-l-border opacity-60' : past ? 'border-l-amber-400' : st.accent,
      )}
    >
      {/* vendedor 🤝 cliente */}
      <div className={cn('flex items-center gap-1.5 text-sm font-semibold min-w-0', done && 'line-through')}>
        <span className="truncate">{vendedorName(appt)}</span>
        <Handshake className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{clienteName(appt)}</span>
      </div>

      {/* tipo (énfasis si cierre) + horario */}
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          done ? 'bg-muted text-muted-foreground border-border' : st.chip,
        )}>
          {!done && st.emphasis && <span className="text-white">●</span>}
          {APPOINTMENT_TIPO_LABEL[appt.tipo]}
        </span>
        <span className="text-xs font-medium text-foreground tabular-nums">
          {formatApptRange(appt.scheduled_at, appt.duration_min)}
        </span>
        {appt.status !== 'programada' && (
          <span className="text-[11px] text-muted-foreground">· {APPOINTMENT_STATUS_LABEL[appt.status]}</span>
        )}
        {past && appt.status === 'programada' && (
          <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-1.5 py-0.5 font-medium">
            Pasada
          </span>
        )}
      </div>

      {appt.lugar && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="size-3" />{appt.lugar}
        </div>
      )}
    </button>
  )
}
