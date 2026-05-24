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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserCircle, Loader2 } from 'lucide-react'
import { createLead } from '@/app/actions/leads'
import { leadSourceValues } from '@/lib/schemas/leads'
import { getInitials } from '@/lib/utils'

const emailSchema = z.string().email('Ingresá un email válido')

// Static model list — later sourced from modelos_vehiculo table
const MODELS = [
  'Onix LT', 'Onix Plus 1.2 Turbo', 'Onix Plus Premier',
  'Tracker LT', 'Tracker Premier',
  'Cruze 5 Premier',
  'Spin LTZ 7as', 'Spin Activ',
  'S10 High Country', 'S10 Midnight',
]

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
  onCreated?: (id: string) => void
}

const EMPTY = {
  nombre: '', telefono: '', email: '', modelo: '', source: '' as string, assigned_to: '',
}

export function NewLeadDialog({
  open,
  onOpenChange,
  vendedores,
  onCreated,
}: NewLeadDialogProps) {
  const [form, setForm] = useState(EMPTY)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setForm(EMPTY)
    setEmailError(null)
  }

  function validateEmail(value: string): string | null {
    if (!value.trim()) return null // campo opcional
    const result = emailSchema.safeParse(value.trim())
    return result.success ? null : result.error.issues[0]?.message ?? 'Email inválido'
  }

  function handleSubmit() {
    // Validar email antes de enviar
    const emailErr = validateEmail(form.email)
    setEmailError(emailErr)
    if (emailErr) return

    startTransition(async () => {
      const res = await createLead({
        nombre:      form.nombre,
        telefono:    form.telefono || undefined,
        email:       form.email    || undefined,
        modelo:      form.modelo   || undefined,
        source:      (form.source || 'Otro') as typeof leadSourceValues[number],
        assigned_to: form.assigned_to || undefined,
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

  const canSubmit = !!form.nombre.trim() && !emailError && !isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nl-nombre">Nombre completo *</Label>
              <Input
                id="nl-nombre"
                placeholder="Ej: Martín Rodríguez"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-phone">Teléfono</Label>
              <Input
                id="nl-phone"
                placeholder="+54 9 11 ..."
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
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
                  setForm((f) => ({ ...f, email: e.target.value }))
                  if (emailError) setEmailError(validateEmail(e.target.value))
                }}
                onBlur={(e) => setEmailError(validateEmail(e.target.value))}
                aria-invalid={!!emailError}
                className={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {emailError && (
                <p className="text-[11px] text-destructive">{emailError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Modelo de interés</Label>
              <Select
                value={form.modelo}
                onValueChange={(v) => setForm((f) => ({ ...f, modelo: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Origen</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="¿De dónde viene?" />
                </SelectTrigger>
                <SelectContent>
                  {leadSourceValues.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {vendedores.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserCircle className="size-3.5 text-muted-foreground" />
                  Asignar vendedor
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Select
                  value={form.assigned_to}
                  onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dejar sin asignar por ahora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => {
                      const name = v.alias || v.nombre || v.user_id
                      return (
                        <SelectItem key={v.user_id} value={v.user_id}>
                          <div className="flex items-center gap-2">
                            <div className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary text-[9px] font-semibold">
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
