'use client'

import { useState, useTransition } from 'react'
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
import { UserCircle, Loader2, Car, ChevronDown } from 'lucide-react'
import { createLead } from '@/app/actions/leads'
import { leadSourceValues } from '@/lib/schemas/leads'
import { getInitials } from '@/lib/utils'
import { useCurrentUser } from '@/lib/tenant/context'

const emailSchema = z.string().email('Ingresá un email válido')

const OTRO_MODELO  = '__otro__'
const OTRO_SOURCE  = '__otro__'
const CUSTOM_PREFIX = '__custom__:'

interface Vendedor {
  user_id: string
  nombre:  string | null
  alias:   string | null
  equipo_id?: string | null
}

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
  localidad: '', provincia: '', horario_preferencia: '',
  tiene_usado: false, observaciones: '', assigned_to: '',
}

export function NewLeadDialog({
  open, onOpenChange, vendedores, modelos = [], customSources = [], onCreated,
}: NewLeadDialogProps) {
  const currentUser  = useCurrentUser()
  const isVendedor   = currentUser.rol === 'vendedor'

  const [form,       setForm]       = useState(EMPTY)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function reset() { setForm(EMPTY); setEmailError(null) }

  function set<K extends keyof typeof EMPTY>(key: K, value: typeof EMPTY[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

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
        horario_preferencia: form.horario_preferencia || undefined,
        tiene_usado:         form.tiene_usado,
        observaciones:       form.observaciones || undefined,
        assigned_to:         form.assigned_to   || undefined,
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

  const canSubmit =
    !!form.nombre.trim() &&
    form.telefono.trim().length >= 6 &&
    form.localidad.trim().length >= 2 &&
    form.provincia.trim().length >= 2 &&
    !!modeloFinal &&
    sourceOk &&
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
                <Label htmlFor="nl-provincia">Provincia <span className="text-destructive">*</span></Label>
                <Input
                  id="nl-provincia"
                  placeholder="Ej: Buenos Aires"
                  value={form.provincia}
                  onChange={(e) => set('provincia', e.target.value)}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Horario de preferencia</Label>
                <input
                  type="time"
                  value={form.horario_preferencia}
                  onChange={(e) => set('horario_preferencia', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
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
                  <div>
                    <span className="text-sm font-medium">¿Tiene auto para dar en parte de pago?</span>
                    {form.tiene_usado && (
                      <span className="ml-2 text-xs text-primary font-medium">→ Cotizar usado al crear</span>
                    )}
                  </div>
                </label>
              </div>
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
                <Label>Asignar vendedor</Label>
                <Select
                  value={form.assigned_to}
                  onValueChange={(v) => set('assigned_to', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => {
                      const name = v.alias || v.nombre || v.user_id
                      return (
                        <SelectItem key={v.user_id} value={v.user_id}>
                          <div className="flex items-center gap-2">
                            <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                              {getInitials(name)}
                            </div>
                            <span>{name}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
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
