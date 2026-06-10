// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ModuleKey =
  | 'pipeline'
  | 'rescate'
  | 'citas'
  | 'ventas'
  | 'historial'
  | 'auditoria'

export interface ModuleDefinition {
  key:         ModuleKey
  nombre:      string
  descripcion: string
  /** Ruta base de la sección — usada para gatear sidebar y proteger la ruta. */
  route:       string
  /** Si está marcado como true, viene activado por defecto en tenants nuevos */
  defaultOn:   boolean
  /** Si es true, el módulo está en desarrollo y se muestra con badge "Próximamente" */
  comingSoon?: boolean
}

// ── Definiciones ──────────────────────────────────────────────────────────────
// Núcleo siempre activo (NO son módulos): Dashboard, Mi Performance, Mis Leads,
// Todos los Leads, Bandeja, Equipo, Cotizador y Configuración.

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key:         'pipeline',
    nombre:      'Pipeline Kanban',
    descripcion: 'Vista de embudo de ventas en columnas por etapa',
    route:       '/pipeline',
    defaultOn:   true,
  },
  {
    key:         'citas',
    nombre:      'Agenda de citas',
    descripcion: 'Calendario y gestión de citas (videollamada, showroom, cierre)',
    route:       '/citas',
    defaultOn:   true,
  },
  {
    key:         'ventas',
    nombre:      'Ventas',
    descripcion: 'Sección con métricas de ventas, ranking y cumplimiento de metas',
    route:       '/ventas',
    defaultOn:   true,
  },
  {
    key:         'historial',
    nombre:      'Historial de leads',
    descripcion: 'Registro de leads cerrados (ventas y bajas) con filtros',
    route:       '/historial',
    defaultOn:   true,
  },
  {
    key:         'rescate',
    nombre:      'Rescate de leads',
    descripcion: 'Bandeja de reactivación para leads abandonados o inactivos',
    route:       '/rescate',
    defaultOn:   true,
  },
  {
    key:         'auditoria',
    nombre:      'Auditoría',
    descripcion: 'Registro de actividad de la empresa (solo visible para el dueño)',
    route:       '/auditoria',
    defaultOn:   true,
  },
]

/** Set de claves de módulo conocidas, para validar y filtrar. */
export const MODULE_KEYS: ModuleKey[] = MODULE_DEFINITIONS.map((m) => m.key)
