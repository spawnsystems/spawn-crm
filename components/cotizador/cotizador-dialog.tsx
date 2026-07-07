'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn, formatCurrencyARS } from '@/lib/utils'
import { calcularUsado, type UsoVehiculo } from '@/lib/cotizador/calc'
import { createCotizacion, updateCotizacion, saveUsadoDraft } from '@/app/actions/cotizaciones'

// Cotización existente a editar (modo edición). Si se pasa, el dialog
// actualiza esa cotización en vez de crear una nueva.
export interface EditingCotizacion {
  id:            string
  marca_modelo:  string | null
  anio:          number | null
  km:            number | null
  uso:           string
  base_infoauto: string | number
}

interface CotizadorDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  leadId?:       string
  leadNombre?:   string
  provincia?:    string
  editing?:      EditingCotizacion | null
  // Pre-población cuando se crea la primera cotización desde un lead con datos
  // del usado anotados al alta (marca/año obligatorios; km/uso/valor opcionales).
  initialMarca?: string
  initialAnio?:  number
  initialKm?:    number
  initialUso?:   string
  initialValor?: number
  onCreated?:    () => void
}

const YEAR_NOW = new Date().getFullYear()

const EMPTY = {
  marca_modelo:  '',
  anio:          '',   // opcional: vacío por defecto (no guardar un año adivinado)
  km:            '',
  uso:           'particular' as UsoVehiculo,
  base_infoauto: '',
}

export function CotizadorDialog({
  open, onOpenChange, leadId, leadNombre, provincia, editing,
  initialMarca, initialAnio, initialKm, initialUso, initialValor, onCreated,
}: CotizadorDialogProps) {
  const [form,      setForm]      = useState(EMPTY)
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function reset() { setForm(EMPTY) }

  // Al abrir: si es edición, precargar los datos de la cotización; si no, limpiar
  // (pero pre-poblar marca si viene de un lead con auto anotado al crear).
  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        marca_modelo:  editing.marca_modelo ?? '',
        anio:          editing.anio != null ? String(editing.anio) : '',
        km:            editing.km != null ? String(editing.km) : '',
        uso:           (editing.uso as UsoVehiculo) || 'particular',
        base_infoauto: editing.base_infoauto != null ? String(Math.round(Number(editing.base_infoauto))) : '',
      })
    } else {
      setForm({
        ...EMPTY,
        marca_modelo:  initialMarca ?? '',
        anio:          initialAnio != null ? String(initialAnio) : EMPTY.anio,
        km:            initialKm != null ? String(initialKm) : '',
        uso:           (initialUso as UsoVehiculo) || 'particular',
        base_infoauto: initialValor != null ? String(Math.round(initialValor)) : '',
      })
    }
  }, [open, editing, initialMarca, initialAnio, initialKm, initialUso, initialValor])

  // ── Preview en vivo ───────────────────────────────────────────
  const preview = useMemo(() => {
    const base = parseFloat(form.base_infoauto.replace(/\./g, '').replace(',', '.'))
    const km   = parseInt(form.km.replace(/\./g, ''), 10)
    const anio = parseInt(form.anio, 10)
    if (!base || base <= 0 || isNaN(km) || isNaN(anio)) return null

    return calcularUsado({ baseInfoauto: base, km, anio, uso: form.uso, provincia })
  }, [form, provincia])

  function handleSubmit() {
    const marca = form.marca_modelo.trim()
    if (!marca) { toast.error('Ingresá al menos la marca y modelo'); return }

    const base = parseFloat(form.base_infoauto.replace(/\./g, '').replace(',', '.'))
    const km   = parseInt(form.km.replace(/\./g, ''), 10)
    const anio = parseInt(form.anio, 10)
    // Hay datos suficientes para calcular el valor de toma
    const puedeCotizar = base > 0 && !isNaN(km) && !isNaN(anio)

    startTransition(async () => {
      // Editar una cotización ya calculada: necesita los datos completos.
      if (editing) {
        if (!puedeCotizar) { toast.error('Para editar la cotización completá año, km y valor InfoAuto'); return }
        const res = await updateCotizacion({
          id: editing.id, marca_modelo: marca, anio, km, uso: form.uso, base_infoauto: base, provincia,
        })
        if (!res.success) { toast.error(res.error); return }
        toast[res.data.result.rechazado ? 'warning' : 'success'](
          res.data.result.rechazado ? 'Cotización actualizada — auto RECHAZADO' : 'Cotización actualizada',
        )
        reset(); onOpenChange(false); onCreated?.()
        return
      }

      // Crear: si alcanza, cotización completa; si no, se anota el auto (borrador).
      if (puedeCotizar) {
        const res = await createCotizacion({
          lead_id: leadId, marca_modelo: marca, anio, km, uso: form.uso, base_infoauto: base, provincia,
        })
        if (!res.success) { toast.error(res.error); return }
        toast[res.data.result.rechazado ? 'warning' : 'success'](
          res.data.result.rechazado ? 'Cotización guardada — auto RECHAZADO' : 'Cotización guardada',
        )
        reset(); onOpenChange(false); onCreated?.()
        return
      }

      // Solo marca (u otros parciales) → guardar el auto como borrador en el lead.
      if (!leadId) { toast.error('Completá año, km y valor InfoAuto para cotizar'); return }
      const res = await saveUsadoDraft({
        leadId,
        marca_modelo:  marca,
        anio:          !isNaN(anio) ? anio : undefined,
        km:            !isNaN(km) ? km : undefined,
        uso:           form.uso,
        base_infoauto: base > 0 ? base : undefined,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('Usado anotado — completá los datos para cotizar')
      reset(); onOpenChange(false); onCreated?.()
    })
  }

  // Solo la marca y modelo es obligatoria (el resto se completa después).
  const canSubmit = form.marca_modelo.trim().length >= 1 && !isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            {editing ? 'Editar cotización' : 'Cotizador de usado'}
            {leadNombre && <span className="text-muted-foreground font-normal text-sm">— {leadNombre}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Datos del vehículo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Marca y modelo <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej: Toyota Corolla"
                value={form.marca_modelo}
                onChange={(e) => set('marca_modelo', e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Año</Label>
              <Input
                type="number"
                placeholder={String(YEAR_NOW - 2)}
                value={form.anio}
                onChange={(e) => set('anio', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kilometraje</Label>
              <Input
                type="number"
                placeholder="Ej: 65000"
                value={form.km}
                onChange={(e) => set('km', e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Tipo de uso</Label>
              <Select value={form.uso} onValueChange={(v) => set('uso', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="taxi_uber_transporte">Taxi / Uber / Transporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor InfoAuto */}
          <div className="space-y-1.5">
            <Label>Valor InfoAuto</Label>
            <Input
              type="number"
              placeholder="Ej: 8500000"
              value={form.base_infoauto}
              onChange={(e) => set('base_infoauto', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Con año + km + valor InfoAuto se calcula el precio de toma. Si no, se anota el auto y lo cotizás después.
            </p>
          </div>

          {/* Preview en vivo */}
          {preview && (
            <div className={cn(
              'rounded-xl border px-4 py-3 space-y-2',
              preview.rechazado
                ? 'bg-rose-50 border-rose-200/60'
                : 'bg-emerald-50 border-emerald-200/60',
            )}>
              {preview.rechazado ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-800">Auto rechazado</p>
                    <p className="text-xs text-rose-700/70 mt-0.5">{preview.rechazoMotivo}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-800">Valor de toma</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Descuento aplicado</p>
                      <p className="font-medium">−{preview.descuentoPct}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor de toma</p>
                      <p className="font-semibold text-primary text-base">{formatCurrencyARS(preview.valorCalculado.toString())}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            {editing ? 'Guardar cambios' : preview ? 'Guardar cotización' : 'Guardar usado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
