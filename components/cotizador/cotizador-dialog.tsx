'use client'

import { useState, useTransition, useMemo } from 'react'
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
import { Loader2, Calculator, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn, formatCurrencyARS } from '@/lib/utils'
import { calcularUsado, condicionesComerciales, type UsoVehiculo } from '@/lib/cotizador/calc'
import { createCotizacion } from '@/app/actions/cotizaciones'

interface CotizadorDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  leadId?:       string
  leadNombre?:   string
  provincia?:    string
  onCreated?:    () => void
}

const YEAR_NOW = new Date().getFullYear()

const EMPTY = {
  marca_modelo:  '',
  anio:          String(YEAR_NOW - 2),
  km:            '',
  uso:           'particular' as UsoVehiculo,
  base_infoauto: '',
}

export function CotizadorDialog({
  open, onOpenChange, leadId, leadNombre, provincia, onCreated,
}: CotizadorDialogProps) {
  const [form,      setForm]      = useState(EMPTY)
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function reset() { setForm(EMPTY) }

  // ── Preview en vivo ───────────────────────────────────────────
  const preview = useMemo(() => {
    const base = parseFloat(form.base_infoauto.replace(/\./g, '').replace(',', '.'))
    const km   = parseInt(form.km.replace(/\./g, ''), 10)
    const anio = parseInt(form.anio, 10)
    if (!base || base <= 0 || isNaN(km) || isNaN(anio)) return null

    return calcularUsado({ baseInfoauto: base, km, anio, uso: form.uso, provincia })
  }, [form, provincia])

  function handleSubmit() {
    const base = parseFloat(form.base_infoauto.replace(/\./g, '').replace(',', '.'))
    const km   = parseInt(form.km.replace(/\./g, ''), 10)
    const anio = parseInt(form.anio, 10)

    if (!base || isNaN(km) || isNaN(anio)) {
      toast.error('Completá al menos: valor InfoAuto, km y año')
      return
    }

    startTransition(async () => {
      const res = await createCotizacion({
        lead_id:       leadId,
        marca_modelo:  form.marca_modelo || undefined,
        anio,
        km,
        uso:           form.uso,
        base_infoauto: base,
        provincia,
      })

      if (!res.success) { toast.error(res.error); return }

      if (res.data.result.rechazado) {
        toast.warning('Cotización guardada — auto RECHAZADO')
      } else {
        toast.success('Cotización guardada')
      }
      reset()
      onOpenChange(false)
      onCreated?.()
    })
  }

  const canSubmit = form.base_infoauto.trim() && form.km.trim() && form.anio.trim() && !isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            Cotizador de usado
            {leadNombre && <span className="text-muted-foreground font-normal text-sm">— {leadNombre}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Datos del vehículo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Marca y modelo</Label>
              <Input
                placeholder="Ej: Toyota Corolla"
                value={form.marca_modelo}
                onChange={(e) => set('marca_modelo', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Año *</Label>
              <Input
                type="number"
                placeholder={String(YEAR_NOW - 2)}
                value={form.anio}
                onChange={(e) => set('anio', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kilometraje *</Label>
              <Input
                type="number"
                placeholder="Ej: 65000"
                value={form.km}
                onChange={(e) => set('km', e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Tipo de uso *</Label>
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
            <Label>Valor InfoAuto *</Label>
            <Input
              type="number"
              placeholder="Ej: 8500000"
              value={form.base_infoauto}
              onChange={(e) => set('base_infoauto', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Ingresá el valor base de InfoAuto</p>
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

          {/* Condiciones comerciales */}
          {(preview || provincia) && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                <Info className="size-3" />
                Condiciones comerciales
              </summary>
              <pre className="mt-1.5 text-[11px] text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-2">
                {condicionesComerciales(provincia)}
              </pre>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Guardar cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
