'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  UserCircle, Loader2, Car, Plus, X, Clock, Calculator, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { createLead } from '@/app/actions/leads'
import { getAsignablesParaLead } from '@/app/actions/users'
import { leadSourceValues } from '@/lib/schemas/leads'
import { getInitials, formatCurrencyARS } from '@/lib/utils'
import { useCurrentUser } from '@/lib/tenant/context'
import { PROVINCIAS_AR, PROVINCIA_DEFAULT } from '@/lib/ar/provincias'
import { type HorarioRange, HORARIO_DAYS } from '@/lib/leads/horarios'
import { calcularUsado, type UsoVehiculo } from '@/lib/cotizador/calc'

const emailSchema = z.string().email('Ingresá un email válido')

const OTRO_MODELO  = '__otro__'
const OTRO_SOURCE  = '__otro__'
const CUSTOM_PREFIX = '__custom__:'

const YEAR_NOW = new Date().getFullYear()

interface Vendedor {
  user_id: string
  nombre:  string | null
  alias:   string | null
  equipo_id?: string | null
}

type Asignables = Awaited<ReturnType<typeof getAsignablesParaLead>>

// Valor combinado del selector de asignación:
//   'unassigned'    → bandeja (sin vendedor ni equipo explícito)
//   'team:<uuid>'   → asignar al equipo (sin vendedor)
//   'vendedor:<uuid>' → asignar directo al vendedor
const ASSIGN_UNASSIGNED = 'unassigned'
const ASSIGN_TEAM_PREFIX = 'team:'
const ASSIGN_VEND_PREFIX = 'vendedor:'

interface NewLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendedores: Vendedor[]
  modelos?: string[]
  customSources?: string[]
  onCreated?: (id: string) => void
}

const EMPTY = {
  nombre: '', telefono: '', email: '', modelo: '', modeloCustom: '',
  source: '' as string, sourceCustom: '',
  localidad: '', provincia: PROVINCIA_DEFAULT as string,
  horarios: [] as HorarioRange[],
  tiene_usado: false, observaciones: '', assign: '',
  // Usado en parte de pago (cotizador inline)
  usadoMarca: '', usadoAnio: String(YEAR_NOW - 2),
  usadoKm: '', usadoUso: 'particular' as UsoVehiculo, usadoBase: '',
}

export function NewLeadDialog({
  open, onOpenChange, vendedores, modelos = [], customSources = [], onCreated,
}: NewLeadDialogProps) {
  const currentUser  = useCurrentUser()
  const isVendedor   = currentUser.rol === 'vendedor'

  const [form,       setForm]       = useState(EMPTY)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()
  const [asignables, setAsignables] = useState<Asignables | null>(null)

  // Cargar equipos/vendedores asignables al abrir (solo para jefes; el vendedor
  // se auto-asigna y no necesita selector).
  useEffect(() => {
    if (!open || isVendedor || asignables) return
    let cancel = false
    getAsignablesParaLead()
      .then((r) => { if (!cancel) setAsignables(r) })
      .catch(() => { /* silencioso: el selector queda vacío */ })
    return () => { cancel = true }
  }, [open, isVendedor, asignables])

  // gerente/dueño manejan varios equipos → deben elegir explícitamente.
  const multiTeam = currentUser.rol === 'gerente' || currentUser.rol === 'dueno' || currentUser.rol === 'platform_admin'

  function reset() { setForm(EMPTY); setEmailError(null) }

  function set<K extends keyof typeof EMPTY>(key: K, value: typeof EMPTY[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // ── Horarios de preferencia (rangos) ──────────────────────────
  function addHorario() {
    setForm((f) => ({ ...f, horarios: [...f.horarios, { from: '', to: '', days: [] }] }))
  }
  function updateHorario(i: number, field: 'from' | 'to', val: string) {
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)),
    }))
  }
  function toggleHorarioDay(i: number, day: number) {
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((r, idx) => {
        if (idx !== i) return r
        const days = r.days ?? []
        return {
          ...r,
          days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
        }
      }),
    }))
  }
  function removeHorario(i: number) {
    setForm((f) => ({ ...f, horarios: f.horarios.filter((_, idx) => idx !== i) }))
  }

  // ── Preview del usado (valor de toma en vivo) ─────────────────
  const usadoNums = useMemo(() => {
    const base = parseFloat(form.usadoBase.replace(/\./g, '').replace(',', '.'))
    const km   = parseInt(form.usadoKm.replace(/\./g, ''), 10)
    const anio = parseInt(form.usadoAnio, 10)
    return { base, km, anio }
  }, [form.usadoBase, form.usadoKm, form.usadoAnio])

  const usadoComplete = !!usadoNums.base && usadoNums.base > 0 && !isNaN(usadoNums.km) && !isNaN(usadoNums.anio)

  const usadoPreview = useMemo(() => {
    if (!form.tiene_usado || !usadoComplete) return null
    return calcularUsado({
      baseInfoauto: usadoNums.base,
      km:           usadoNums.km,
      anio:         usadoNums.anio,
      uso:          form.usadoUso,
      provincia:    form.provincia,
    })
  }, [form.tiene_usado, usadoComplete, usadoNums, form.usadoUso, form.provincia])

  function validateEmail(value: string): string | null {
    if (!value.trim()) return null
    const r = emailSchema.safeParse(value.trim())
    return r.success ? null : (r.error.issues[0]?.message ?? 'Email inválido')
  }

  // Modelo efectivo: si eligió OTRO_MODELO usa el texto libre, si no usa la opción
  const modeloFinal = form.modelo === OTRO_MODELO ? form.modeloCustom.trim() : form.modelo

  // Source efectivo:
  //   - Valor estándar del enum   → sourceFinal = ese valor, sin custom
  //   - '__custom__:Nombre'       → sourceFinal = 'Otro', sourceCustom = 'Nombre' (fuente previamente guardada)
  //   - '__otro__' (texto libre)  → sourceFinal = 'Otro', sourceCustom = lo que escribió el usuario
  const isCustomSaved = form.source.startsWith(CUSTOM_PREFIX)
  const sourceFinal: typeof leadSourceValues[number] = (form.source === OTRO_SOURCE || isCustomSaved)
    ? 'Otro'
    : form.source as typeof leadSourceValues[number]
  const sourceCustom = isCustomSaved
    ? form.source.slice(CUSTOM_PREFIX.length)
    : form.source === OTRO_SOURCE
    ? form.sourceCustom.trim()
    : undefined

  function handleSubmit() {
    const emailErr = validateEmail(form.email)
    setEmailError(emailErr)
    if (emailErr) return

    // Rangos válidos (ambos extremos cargados)
    const horariosValidos = form.horarios.filter((r) => r.from && r.to)

    // Usado: si está activo y los datos mínimos están, mandamos la cotización inline
    const usadoPayload = form.tiene_usado && usadoComplete
      ? {
          marca_modelo:  form.usadoMarca.trim() || undefined,
          anio:          usadoNums.anio,
          km:            usadoNums.km,
          uso:           form.usadoUso,
          base_infoauto: usadoNums.base,
        }
      : undefined

    // Parsear el destino de asignación.
    let assignedTo: string | undefined
    let equipoId:   string | undefined
    if (form.assign.startsWith(ASSIGN_VEND_PREFIX)) {
      assignedTo = form.assign.slice(ASSIGN_VEND_PREFIX.length)
    } else if (form.assign.startsWith(ASSIGN_TEAM_PREFIX)) {
      equipoId = form.assign.slice(ASSIGN_TEAM_PREFIX.length)
    }
    // ASSIGN_UNASSIGNED / '' → sin asignar (el server decide la bandeja)

    startTransition(async () => {
      const res = await createLead({
        nombre:              form.nombre,
        telefono:            form.telefono,
        email:               form.email    || undefined,
        modelo:              modeloFinal,
        source:              sourceFinal,
        source_custom:       sourceCustom  || undefined,
        localidad:           form.localidad,
        provincia:           form.provincia,
        horarios:            horariosValidos.length ? horariosValidos : undefined,
        tiene_usado:         form.tiene_usado,
        usado:               usadoPayload,
        observaciones:       form.observaciones || undefined,
        assigned_to:         assignedTo,
        equipo_id:           equipoId,
      })

      if (res.success) {
        toast.success('Lead creado')
        reset()
        onOpenChange(false)
        onCreated?.(res.data.id)
      } else {
        toast.error(res.error)
      }
    })
  }

  // Origen válido: algo seleccionado; si es "escribir", el texto debe tener al menos 2 chars
  const sourceOk = !!form.source && (form.source !== OTRO_SOURCE || form.sourceCustom.trim().length >= 2)

  // gerente/dueño deben elegir un destino explícito (equipo o vendedor); si no,
  // el lead podría quedar sin visibilidad para ellos. Supervisor/vendedor no.
  const assignOk = isVendedor || !multiTeam || form.assign !== ''

  const canSubmit =
    !!form.nombre.trim() &&
    form.telefono.trim().length >= 6 &&
    form.localidad.trim().length >= 2 &&
    form.provincia.trim().length >= 2 &&
    !!modeloFinal &&
    sourceOk &&
    assignOk &&
    !emailError &&
    !isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* ── Sección: Contacto ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="nl-nombre">Nombre completo *</Label>
                <Input
                  id="nl-nombre"
                  placeholder="Ej: Martín Rodríguez"
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-phone">Teléfono <span className="text-destructive">*</span></Label>
                <Input
                  id="nl-phone"
                  placeholder="+54 9 11 ..."
                  value={form.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-email">Email</Label>
                <Input
                  id="nl-email"
                  type="email"
                  placeholder="opcional"
                  value={form.email}
                  onChange={(e) => {
                    set('email', e.target.value)
                    if (emailError) setEmailError(validateEmail(e.target.value))
                  }}
                  onBlur={(e) => setEmailError(validateEmail(e.target.value))}
                  aria-invalid={!!emailError}
                  className={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-localidad">Localidad <span className="text-destructive">*</span></Label>
                <Input
                  id="nl-localidad"
                  placeholder="Ej: Mar del Plata"
                  value={form.localidad}
                  onChange={(e) => set('localidad', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Provincia <span className="text-destructive">*</span></Label>
                <Select value={form.provincia} onValueChange={(v) => set('provincia', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar provincia..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PROVINCIAS_AR.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Horarios de preferencia — rangos personalizables */}
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  Horarios de preferencia
                </Label>
                {form.horarios.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin franjas. Agregá una o más (ej: 09:00–12:00 y 17:00–19:00).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.horarios.map((r, i) => {
                      const invalid = r.from && r.to && r.from >= r.to
                      const days = r.days ?? []
                      return (
                        <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={r.from}
                              onChange={(e) => updateHorario(i, 'from', e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            <span className="text-muted-foreground text-sm shrink-0">a</span>
                            <input
                              type="time"
                              value={r.to}
                              onChange={(e) => updateHorario(i, 'to', e.target.value)}
                              className={`flex h-9 w-full rounded-md border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                invalid ? 'border-destructive' : 'border-input'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => removeHorario(i)}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                              title="Quitar franja"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          {/* Días de la semana — vacío = cualquier día */}
                          <div className="flex flex-wrap gap-1">
                            {HORARIO_DAYS.map((label, d) => {
                              const on = days.includes(d)
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => toggleHorarioDay(i, d)}
                                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                    on
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background text-muted-foreground border-input hover:bg-muted'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                            {days.length === 0 && (
                              <span className="self-center text-[11px] text-muted-foreground/70 ml-1">
                                Cualquier día
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Button
                  type="button" size="sm" variant="outline"
                  className="h-7 gap-1 text-xs mt-1"
                  onClick={addHorario}
                >
                  <Plus className="size-3" />Agregar franja
                </Button>
              </div>
            </div>
          </div>

          {/* ── Sección: Vehículo ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Vehículo</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Modelo de interés con "Otro" inline */}
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Car className="size-3.5 text-muted-foreground" />
                  Modelo de interés <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.modelo}
                  onValueChange={(v) => {
                    set('modelo', v)
                    if (v !== OTRO_MODELO) set('modeloCustom', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Sin modelos — agregá uno en{' '}
                        <span className="font-medium">Configuración → Modelos</span>
                      </div>
                    ) : (
                      modelos.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))
                    )}
                    <SelectItem value={OTRO_MODELO}>
                      <span className="text-muted-foreground">Otro (escribir)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.modelo === OTRO_MODELO && (
                  <Input
                    placeholder="Escribí el modelo..."
                    value={form.modeloCustom}
                    onChange={(e) => set('modeloCustom', e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              {/* Tiene usado */}
              <div className="col-span-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.tiene_usado}
                    onClick={() => set('tiene_usado', !form.tiene_usado)}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                      form.tiene_usado ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      form.tiene_usado ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-sm font-medium">¿Tiene auto para dar en parte de pago?</span>
                </label>
              </div>

              {/* Cotizador del usado — aparece inline al activar el switch */}
              {form.tiene_usado && (
                <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <Calculator className="size-3.5" />
                    Cotización del usado
                    <span className="font-normal text-amber-700/70">— se calcula con reglas InfoAuto</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Marca y modelo</Label>
                      <Input
                        placeholder="Ej: Toyota Corolla"
                        className="h-8 text-sm bg-white"
                        value={form.usadoMarca}
                        onChange={(e) => set('usadoMarca', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Año</Label>
                      <Input
                        type="number" className="h-8 text-sm bg-white"
                        placeholder={String(YEAR_NOW - 2)}
                        value={form.usadoAnio}
                        onChange={(e) => set('usadoAnio', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kilometraje</Label>
                      <Input
                        type="number" className="h-8 text-sm bg-white"
                        placeholder="Ej: 65000"
                        value={form.usadoKm}
                        onChange={(e) => set('usadoKm', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo de uso</Label>
                      <Select value={form.usadoUso} onValueChange={(v) => set('usadoUso', v as UsoVehiculo)}>
                        <SelectTrigger className="h-8 text-sm bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particular">Particular</SelectItem>
                          <SelectItem value="taxi_uber_transporte">Taxi / Uber / Transporte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor InfoAuto</Label>
                      <Input
                        type="number" className="h-8 text-sm bg-white"
                        placeholder="Ej: 8500000"
                        value={form.usadoBase}
                        onChange={(e) => set('usadoBase', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Preview en vivo del valor de toma */}
                  {usadoPreview && (
                    usadoPreview.rechazado ? (
                      <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200/60 px-3 py-2">
                        <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-rose-800">Auto rechazado</p>
                          <p className="text-xs text-rose-700/70 mt-0.5">{usadoPreview.rechazoMotivo}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200/60 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                          <span className="text-xs text-emerald-800">Valor de toma (−{usadoPreview.descuentoPct}%)</span>
                        </div>
                        <span className="text-sm font-semibold text-emerald-700">
                          {formatCurrencyARS(usadoPreview.valorCalculado.toString())}
                        </span>
                      </div>
                    )
                  )}

                  <p className="text-[11px] text-amber-700/70">
                    Podés dejarlo vacío y cotizar más tarde desde la ficha del lead.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Sección: Origen ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Origen</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Source — estándar + personalizadas del tenant + "Otro" */}
              <div className="space-y-1.5">
                <Label>¿De dónde viene? <span className="text-destructive">*</span></Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => {
                    set('source', v)
                    if (v !== OTRO_SOURCE) set('sourceCustom', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar origen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Fuentes estándar */}
                    <SelectGroup>
                      {leadSourceValues.filter((s) => s !== 'Otro').map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectGroup>

                    {/* Fuentes personalizadas guardadas previamente */}
                    {customSources.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-[11px]">Personalizadas</SelectLabel>
                          {customSources.map((s) => (
                            <SelectItem key={s} value={`${CUSTOM_PREFIX}${s}`}>{s}</SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}

                    {/* Siempre al final: escribir texto libre (se guardará) */}
                    <SelectSeparator />
                    <SelectItem value={OTRO_SOURCE}>
                      <span className="text-muted-foreground">Otro (escribir...)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {form.source === OTRO_SOURCE && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Ej: Expo Auto 2025, Instagram Story..."
                      value={form.sourceCustom}
                      onChange={(e) => set('sourceCustom', e.target.value)}
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se guardará como fuente disponible para el próximo lead.
                    </p>
                  </div>
                )}
              </div>

              {isVendedor ? (
                // Vendedor siempre se auto-asigna — mostramos solo la info
                <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <UserCircle className="size-4 shrink-0" />
                  <span>Se te asignará automáticamente</span>
                </div>
              ) : (
              <div className="space-y-1.5">
                <Label>
                  {multiTeam ? 'Asignar a equipo o vendedor' : 'Asignar vendedor'}
                  {multiTeam && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Select
                  value={form.assign}
                  onValueChange={(v) => set('assign', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={multiTeam ? 'Elegí equipo o vendedor...' : 'Sin asignar...'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {/* Bandeja sin asignar:
                        - supervisor → queda en su equipo (lo deriva luego)
                        - dueño/admin → bandeja general del tenant */}
                    {(!multiTeam || currentUser.rol === 'dueno' || currentUser.rol === 'platform_admin') && (
                      <SelectItem value={ASSIGN_UNASSIGNED}>
                        <span className="text-muted-foreground">
                          {multiTeam ? 'Bandeja general (sin equipo)' : 'Sin asignar (queda en el equipo)'}
                        </span>
                      </SelectItem>
                    )}

                    {(asignables?.equipos ?? []).map((eq) => (
                      <SelectGroup key={eq.id}>
                        <SelectLabel className="text-[11px] uppercase tracking-wide">{eq.nombre}</SelectLabel>
                        {/* Asignar al equipo (sin vendedor) — solo para gerente/dueño */}
                        {multiTeam && (
                          <SelectItem value={`${ASSIGN_TEAM_PREFIX}${eq.id}`}>
                            <span className="flex items-center gap-2">
                              <UserCircle className="size-4 text-muted-foreground" />
                              <span>Dejar en el equipo (lo deriva el supervisor)</span>
                            </span>
                          </SelectItem>
                        )}
                        {eq.vendedores.length === 0 ? (
                          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Sin vendedores</div>
                        ) : (
                          eq.vendedores.map((v) => {
                            const name = v.alias || v.nombre || v.user_id
                            return (
                              <SelectItem key={v.user_id} value={`${ASSIGN_VEND_PREFIX}${v.user_id}`}>
                                <div className="flex items-center gap-2">
                                  <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                                    {getInitials(name)}
                                  </div>
                                  <span>{name}</span>
                                </div>
                              </SelectItem>
                            )
                          })
                        )}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
            </div>
          </div>

          {/* ── Sección: Observaciones ── */}
          <div className="space-y-1.5">
            <Label htmlFor="nl-obs">Observaciones</Label>
            <Textarea
              id="nl-obs"
              placeholder="Comentarios, detalles adicionales, situación del cliente..."
              className="min-h-[70px] resize-none text-sm"
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
            />
          </div>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { reset(); onOpenChange(false) }}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Crear lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
