// ── Cotizador de usados — lógica pura (sin DB, 100% testeable) ─────────────
// Reglas InfoAuto para la concesionaria Central Autos.

export type UsoVehiculo = 'particular' | 'taxi_uber_transporte'

export interface CotizadorInput {
  baseInfoauto: number      // valor base ingresado por el vendedor (InfoAuto manual)
  km:           number      // kilometraje actual del vehículo
  anio:         number      // año del vehículo
  uso:          UsoVehiculo
  provincia?:   string      // para mostrar condiciones comerciales relevantes
}

export interface CotizadorResult {
  rechazado:       boolean
  rechazoMotivo?:  string
  descuentoPct:    number          // porcentaje de descuento (0 si rechazado)
  valorCalculado:  number          // base * (1 - descuentoPct/100), redondeado
  condiciones:     string          // texto de condiciones comerciales
}

// ── Condiciones comerciales fijas ────────────────────────────────────────────

export function condicionesComerciales(provincia?: string): string {
  const prov = (provincia ?? '').toLowerCase().trim()
  const esBsAs  = prov.includes('buenos aires') || prov.includes('capital') || prov.includes('caba')
  const esGba   = prov.includes('gba') || prov.includes('gran buenos aires') || prov.includes('conurbano')
  const esInterior = prov !== '' && !esBsAs && !esGba

  const lines = [
    '• No se trabaja con reventas.',
    '• El sistema "Llave por llave" aplica únicamente en Buenos Aires.',
  ]

  if (esBsAs || esGba) {
    lines.push('• Cotización CABA/GBA: sujeta a revisión final presencial.')
  } else if (esInterior) {
    lines.push('• Cotización del interior: digital, siempre que el auto esté en perfectas condiciones de chapa, pintura y mecánica.')
  } else {
    lines.push('• Cotización sujeta a revisión según ubicación del vehículo.')
  }

  return lines.join('\n')
}

// ── Reglas de descuento ───────────────────────────────────────────────────────

/**
 * Calcula el valor de toma de un auto usado aplicando las reglas InfoAuto.
 *
 * Particulares:
 *   ≤ 50.000 km  → −15%
 *   > 50.000 km  → −20%
 *
 * Taxi / Uber / Transporte:
 *   Solo si año > 2016 Y km < 300.000 (de lo contrario: rechazado)
 *   < 100.000 km           → −25%
 *   100.000 < km ≤ 200.000 → −35%
 *   > 200.000 km           → −45%
 */
export function calcularUsado(input: CotizadorInput): CotizadorResult {
  const { baseInfoauto, km, anio, uso, provincia } = input
  const condiciones = condicionesComerciales(provincia)

  if (baseInfoauto <= 0) {
    return {
      rechazado:    true,
      rechazoMotivo: 'El valor base InfoAuto debe ser mayor a 0.',
      descuentoPct: 0,
      valorCalculado: 0,
      condiciones,
    }
  }

  // ── Taxi / Uber / Transporte ──
  if (uso === 'taxi_uber_transporte') {
    if (anio <= 2016 || km >= 300_000) {
      return {
        rechazado:    true,
        rechazoMotivo: anio <= 2016
          ? `Año ${anio}: solo se toman vehículos de uso comercial posteriores al 2016.`
          : `${km.toLocaleString('es-AR')} km: solo se toman vehículos con menos de 300.000 km.`,
        descuentoPct: 0,
        valorCalculado: 0,
        condiciones,
      }
    }

    let pct: number
    if (km < 100_000)              pct = 25
    else if (km <= 200_000)        pct = 35
    else                           pct = 45

    const valorCalculado = Math.round(baseInfoauto * (1 - pct / 100))
    return { rechazado: false, descuentoPct: pct, valorCalculado, condiciones }
  }

  // ── Particular ──
  const pct = km <= 50_000 ? 15 : 20
  const valorCalculado = Math.round(baseInfoauto * (1 - pct / 100))
  return { rechazado: false, descuentoPct: pct, valorCalculado, condiciones }
}
