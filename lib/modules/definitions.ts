// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ModuleKey =
  | 'pipeline'
  | 'rescate'
  | 'test_drive'
  | 'cotizaciones'
  | 'inventario'
  | 'reportes'

export interface ModuleDefinition {
  key:         ModuleKey
  nombre:      string
  descripcion: string
  /** Si está marcado como true, viene activado por defecto en tenants nuevos */
  defaultOn:   boolean
  /** Si es true, el módulo está en desarrollo y se muestra con badge "Próximamente" */
  comingSoon?: boolean
}

// ── Definiciones ──────────────────────────────────────────────────────────────

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key:         'pipeline',
    nombre:      'Pipeline Kanban',
    descripcion: 'Vista de embudo de ventas en columnas arrastrables',
    defaultOn:   true,
  },
  {
    key:         'rescate',
    nombre:      'Rescate de leads',
    descripcion: 'Campaña de reactivación para leads abandonados (+15 días)',
    defaultOn:   true,
  },
  {
    key:         'test_drive',
    nombre:      'Agenda de test drives',
    descripcion: 'Calendario y gestión de citas de test drive por vendedor',
    defaultOn:   false,
    comingSoon:  true,
  },
  {
    key:         'cotizaciones',
    nombre:      'Cotizador de usados',
    descripcion: 'Cálculo del valor de toma de autos usados con reglas InfoAuto por km y uso',
    defaultOn:   true,
  },
  {
    key:         'inventario',
    nombre:      'Catálogo vehicular',
    descripcion: 'Stock de modelos, versiones, colores y precios actualizados',
    defaultOn:   false,
    comingSoon:  true,
  },
  {
    key:         'reportes',
    nombre:      'Reportes avanzados',
    descripcion: 'Exportación a Excel, tendencias históricas y comparativas de equipo',
    defaultOn:   false,
    comingSoon:  true,
  },
]
