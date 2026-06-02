'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, XCircle } from 'lucide-react'
import { darDeBaja } from '@/app/actions/leads'
import { bajaStatusValues } from '@/lib/schemas/leads'
import { STATUS_LABEL } from '@/lib/leads/constants'

interface BajaDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  leadId:        string
  leadNombre:    string
  onDone:        () => void
  /** Si se pasa, el select arranca prefijado con ese estado. */
  prefilledStatus?: typeof bajaStatusValues[number]
}

export function BajaDialog({
  open, onOpenChange, leadId, leadNombre, onDone, prefilledStatus,
}: BajaDialogProps) {
  const [status,  setStatus]  = useState<string>(prefilledStatus ?? '')
  const [motivo,  setMotivo]  = useState('')
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    if (isPending) return
    setStatus(prefilledStatus ?? '')
    setMotivo('')
    onOpenChange(false)
  }

  function handleSubmit() {
    if (!status || motivo.trim().length < 3) return
    startTransition(async () => {
      const res = await darDeBaja({ leadId, status, motivo: motivo.trim() })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Lead dado de baja')
      handleClose()
      onDone()
    })
  }

  const canSubmit = status !== '' && motivo.trim().length >= 3 && !isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4" />
            Dar de baja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Lead: <span className="font-medium text-foreground">{leadNombre}</span>
          </p>

          {/* Motivo estructurado */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Razón de baja</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Elegir razón..." />
              </SelectTrigger>
              <SelectContent>
                {bajaStatusValues.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción libre — obligatoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Detalle <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Ej: No le dio el presupuesto, quiere algo más económico..."
              className="min-h-[80px] resize-none text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit() }}
            />
            <p className="text-[11px] text-muted-foreground">
              Mínimo 3 caracteres · Ctrl+Enter para guardar
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {isPending
              ? <Loader2 className="size-4 animate-spin" />
              : <XCircle className="size-4" />}
            Dar de baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
