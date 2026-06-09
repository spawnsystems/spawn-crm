'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trophy } from 'lucide-react'
import { registrarVenta, getLeadContactoParaVenta } from '@/app/actions/cotizaciones'

interface RegistrarVentaDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  leadId:        string
  leadNombre:    string
  defaultModelo?: string | null
  onDone?:       () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Confirma la venta de un lead que está en CIERRE. Es la única vía para
 * llevar el lead al estado terminal VENTA (la action exige CIERRE server-side).
 * Captura y confirma los datos del comprador (teléfono, alternativo, DNI, email).
 */
export function RegistrarVentaDialog({
  open, onOpenChange, leadId, leadNombre, defaultModelo, onDone,
}: RegistrarVentaDialogProps) {
  const [modelo,      setModelo]      = useState(defaultModelo ?? '')
  const [monto,       setMonto]       = useState('')
  const [telefono,    setTelefono]    = useState('')
  const [telefonoAlt, setTelefonoAlt] = useState('')
  const [dni,         setDni]         = useState('')
  const [email,       setEmail]       = useState('')
  const [loadingPrefill, setLoadingPrefill] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Al abrir, precargamos teléfono y email del lead para confirmarlos.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingPrefill(true)
    getLeadContactoParaVenta(leadId)
      .then((c) => {
        if (cancelled || !c) return
        setTelefono((prev) => prev || c.telefono || '')
        setEmail((prev) => prev || c.email || '')
      })
      .finally(() => { if (!cancelled) setLoadingPrefill(false) })
    return () => { cancelled = true }
  }, [open, leadId])

  const telefonoOk = telefono.trim().length >= 6
  const dniOk      = dni.trim().length >= 6
  const emailOk    = EMAIL_RE.test(email.trim())
  const canSubmit  = telefonoOk && dniOk && emailOk && !isPending

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const montoNum = monto.trim() ? Number(monto.replace(/[^\d]/g, '')) : undefined
      const res = await registrarVenta({
        lead_id: leadId,
        modelo:  modelo.trim() || undefined,
        monto:   montoNum && montoNum > 0 ? montoNum : undefined,
        comprador_telefono:     telefono.trim(),
        comprador_telefono_alt: telefonoAlt.trim() || undefined,
        comprador_dni:          dni.trim(),
        comprador_email:        email.trim(),
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

          {/* Datos del comprador */}
          <div className="pt-1 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground pt-3 pb-1">
              Datos del comprador
              {loadingPrefill && <Loader2 className="inline size-3 animate-spin ml-1.5 align-[-1px]" />}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-tel">Teléfono <span className="text-destructive">*</span></Label>
                <Input
                  id="rv-tel"
                  inputMode="tel"
                  placeholder="Confirmá el teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-tel-alt">Teléfono alternativo</Label>
                <Input
                  id="rv-tel-alt"
                  inputMode="tel"
                  placeholder="Opcional"
                  value={telefonoAlt}
                  onChange={(e) => setTelefonoAlt(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-dni">DNI <span className="text-destructive">*</span></Label>
                <Input
                  id="rv-dni"
                  inputMode="numeric"
                  placeholder="Sin puntos"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="rv-email"
                  type="email"
                  placeholder="comprador@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            {email.trim().length > 0 && !emailOk && (
              <p className="text-[11px] text-destructive mt-1.5">El email no tiene un formato válido.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
