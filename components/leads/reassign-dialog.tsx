'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select'
import { UserCheck, UserCircle, Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/lib/tenant/context'
import { assignLead, assignLeadToTeam } from '@/app/actions/leads'

// ── ReassignDialog ────────────────────────────────────────────────────────────
// Asignación inmediata (supervisor+), sin aprobación: a un vendedor del alcance,
// a uno mismo, derivar a un equipo (dueño/gerente) o a la Bandeja General.
// Vive en su propio archivo para poder usarse desde la ficha del lead y desde la
// tabla "Sin asignar" de Mis Leads.

const SIN_ASIGNAR = '__none__'
const TEAM_PREFIX = 'team:'

type AssignableVendedor = { user_id: string; nombre: string | null; alias: string | null }

export function ReassignDialog({
  open, onOpenChange, leadId, leadNombre, assignedTo, vendedores, teams = [], onDone,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  leadId:       string
  leadNombre:   string
  assignedTo:   string | null
  vendedores:   AssignableVendedor[]
  teams?:       { id: string; nombre: string }[]
  onDone:       () => void
}) {
  const currentUser = useCurrentUser()
  const [toUserId,  setToUserId]      = useState('')
  const [isPending, startTransition]  = useTransition()

  // No ofrecer al vendedor ya asignado
  const candidates = vendedores.filter((v) => v.user_id !== assignedTo)
  // El jefe puede quedarse el lead para trabajarlo (salvo que ya sea suyo).
  const canSelfAssign = assignedTo !== currentUser.id

  function handleSubmit() {
    if (!toUserId) { toast.error('Seleccioná una opción'); return }
    startTransition(async () => {
      // Derivar a un equipo (queda sin asignar en la bandeja de ese equipo).
      if (toUserId.startsWith(TEAM_PREFIX)) {
        const equipoId = toUserId.slice(TEAM_PREFIX.length)
        const res = await assignLeadToTeam(leadId, equipoId)
        if (!res.success) { toast.error(res.error); return }
        const teamName = teams.find((t) => t.id === equipoId)?.nombre
        toast.success(teamName ? `Derivado al equipo ${teamName}` : 'Lead derivado al equipo')
        setToUserId('')
        onDone()
        return
      }
      const target = toUserId === SIN_ASIGNAR ? null : toUserId
      const res = await assignLead(leadId, target)
      if (!res.success) { toast.error(res.error); return }
      toast.success(
        !target ? 'Lead enviado a Bandeja General'
        : target === currentUser.id ? 'Te asignaste el lead'
        : 'Lead reasignado',
      )
      setToUserId('')
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setToUserId(''); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-4 text-indigo-600" />
            Asignar lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Elegí a quién asignar{' '}
            <span className="font-semibold text-foreground">{leadNombre}</span>.
            El cambio es inmediato, no requiere aprobación.
          </p>

          <div className="space-y-1.5">
            <Label>Asignar a *</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {canSelfAssign && (
                  <SelectItem value={currentUser.id}>
                    <span className="flex items-center gap-2 font-medium">
                      <UserCircle className="size-4 text-primary" />
                      Asignármelo a mí
                    </span>
                  </SelectItem>
                )}
                {/* Derivar a un equipo (queda sin asignar para que lo distribuya
                    su supervisor). Solo dueño/gerente reciben equipos. */}
                {teams.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[11px] uppercase tracking-wide">Derivar a un equipo</SelectLabel>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={`${TEAM_PREFIX}${t.id}`}>
                        <span className="flex items-center gap-2">
                          <UserCheck className="size-4 text-muted-foreground" />
                          {t.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {candidates.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[11px] uppercase tracking-wide">Vendedores</SelectLabel>
                    {candidates.map((v) => (
                      <SelectItem key={v.user_id} value={v.user_id}>
                        {v.alias || v.nombre || v.user_id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectItem value={SIN_ASIGNAR}>
                  <span className="text-muted-foreground italic">
                    {currentUser.rol === 'supervisor'
                      ? 'Quitar asignación (vuelve a Sin asignar del equipo)'
                      : 'Sin asignar (Bandeja General)'}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!toUserId || isPending}
            className="gap-1.5"
          >
            {isPending
              ? <Loader2 className="size-4 animate-spin" />
              : <UserCheck className="size-4" />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
