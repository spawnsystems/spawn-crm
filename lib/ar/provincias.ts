// Jurisdicciones de Argentina (23 provincias + CABA).
// Orden: CABA primero (default), luego alfabético.

export const PROVINCIAS_AR = [
  'CABA',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const

export type ProvinciaAR = (typeof PROVINCIAS_AR)[number]

export const PROVINCIA_DEFAULT: ProvinciaAR = 'CABA'
