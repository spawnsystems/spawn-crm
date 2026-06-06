'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trophy } from 'lucide-react'
import { registrarVenta } from '@/app/actions/cotizaciones'

interface RegistrarVentaDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  leadId:        string
  leadNombre:    string
  defaultModelo?: string | null
  onDone?:       () => void
}

/**
 * Confirma la venta de un lead que está en CIERRE. Es la única vía para
 * llevar el lead al estado terminal VENTA (la action exige CIERRE server-side).
 */
export function RegistrarVentaDialog({
  open, onOpenChange, leadId, leadNombre, defaultModelo, onDone,
}: RegistrarVentaDialogProps) {
  const [modelo,    setModelo]    = useState(defaultModelo ?? '')
  const [monto,     setMonto]     = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const montoNum = monto.trim() ? Number(monto.replace(/[^\d]/g, '')) : undefined
      const res = await registrarVenta({
        lead_id: leadId,
        modelo:  modelo.trim() || undefined,
        monto:   montoNum && montoNum > 0 ? montoNum : undefined,
      })
      if (res.success) {
        toast.success('¡Venta registrada!')
        onOpenChange(false)
        onDone?.()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-emerald-600" />
            Registrar venta
          </DialogTitle>
          <DialogDescription>
            Confirmás la venta de <span className="font-medium text-foreground">{leadNombre}</span>.
            El lead pasará a estado <span className="font-medium text-foreground">VENTA</span> (final).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rv-modelo">Modelo vendido</Label>
            <Input
              id="rv-modelo"
              placeholder="Ej: TRACKER 1.2T LT AT"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-monto">Monto (opcional)</Label>
            <Input
              id="rv-monto"
              inputMode="numeric"
              placeholder="Ej: 28000000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
