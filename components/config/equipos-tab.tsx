'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Users, Loader2, UserMinus } from 'lucide-react'
import {
  createEquipo, updateEquipo,
  addMemberToEquipo, removeMemberFromEquipo,
} from '@/app/actions/equipos'
import { getInitials } from '@/lib/utils'
import type { getEquiposConMiembros } from '@/app/actions/equipos'
import type { getMiembrosDelTenant } from '@/app/actions/equipos'

type EquipoConMiembros = Awaited<ReturnType<typeof getEquiposConMiembros>>[number]
type Miembro = Awaited<ReturnType<typeof getMiembrosDelTenant>>[number]

interface EquiposTabProps {
  initialEquipos:  EquipoConMiembros[]
  allMiembros:     Miembro[]
}

const EMPTY_FORM = { nombre: '', gerente_id: '', supervisor_id: '' }
const NONE = '__none__'

export function EquiposTab({ initialEquipos, allMiembros }: EquiposTabProps) {
  const [equipos,    setEquipos]    = useState<EquipoConMiembros[]>(initialEquipos)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing,    setEditing]    = useState<EquipoConMiembros | null>(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [isPending,  startTransition] = useTransition()

  // Gerentes/supervisors candidates
  const gerentes    = allMiembros.filter((m) => ['gerente', 'dueno', 'platform_admin'].includes(m.rol))
  const supervisors = allMiembros.filter((m) => ['supervisor', 'gerente'].includes(m.rol))

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(eq: EquipoConMiembros) {
    setEditing(eq)
    setForm({
      nombre:       eq.nombre,
      gerente_id:   eq.gerente_id    ?? '',
      supervisor_id: eq.supervisor_id ?? '',
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.nombre.trim()) return

    startTransition(async () => {
      const payload = {
        nombre:        form.nombre.trim(),
        gerente_id:    form.gerente_id    || null,
        supervisor_id: form.supervisor_id || null,
      }

      if (editing) {
        const res = await updateEquipo(editing.id, payload)
        if (res.success) {
          toast.success('Equipo actualizado')
          setEquipos((prev) =>
            prev.map((e) => e.id === editing.id ? { ...e, ...payload } : e),
          )
          setDialogOpen(false)
        } else {
          toast.error(res.error)
        }
      } else {
        const res = await createEquipo(payload)
        if (res.success) {
          toast.success('Equipo creado')
          setDialogOpen(false)
          // The new equipo starts with no members
          if ('data' in res) {
            setEquipos((prev) => [
              ...prev,
              {
                id:            res.data.id,
                nombre:        payload.nombre,
                activo:        true,
                gerente_id:    payload.gerente_id,
                supervisor_id: payload.supervisor_id,
                gerente:       gerentes.find((g) => g.user_id === payload.gerente_id)    ?? null,
                supervisor:    supervisors.find((s) => s.user_id === payload.supervisor_id) ?? null,
                vendedores:    [],
              },
            ])
          }
        } else {
          toast.error(res.error)
        }
      }
    })
  }

  function handleAddMember(equipoId: string, userId: string) {
    startTransition(async () => {
      const res = await addMemberToEquipo(userId, equipoId)
      if (res.success) {
        const miembro = allMiembros.find((m) => m.user_id === userId)
        if (miembro) {
          setEquipos((prev) =>
            prev.map((e) =>
              e.id === equipoId
                ? { ...e, vendedores: [...e.vendedores, { ...miembro, equipo_id: equipoId }] }
                : e,
            ),
          )
        }
        toast.success('Miembro agregado')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleRemoveMember(equipoId: string, userId: string) {
    startTransition(async () => {
      const res = await removeMemberFromEquipo(userId)
      if (res.success) {
        setEquipos((prev) =>
          prev.map((e) =>
            e.id === equipoId
              ? { ...e, vendedores: e.vendedores.filter((v) => v.user_id !== userId) }
              : e,
          ),
        )
      } else {
        toast.error(res.error)
      }
    })
  }

  // Vendedores sin equipo (available to assign)
  const assignedIds = new Set(equipos.flatMap((e) => e.vendedores.map((v) => v.user_id)))
  const unassigned  = allMiembros.filter(
    (m) => m.rol === 'vendedor' && !assignedIds.has(m.user_id),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {equipos.length} equipo{equipos.length !== 1 ? 's' : ''}
          {unassigned.length > 0 && (
            <span className="ml-2 text-amber-600 font-medium">
              · {unassigned.length} vendedor{unassigned.length !== 1 ? 'es' : ''} sin asignar
            </span>
          )}
        </p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-3.5" />Nuevo equipo
        </Button>
      </div>

      {equipos.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay equipos todavía. Creá uno para organizar a tus vendedores.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {equipos.map((eq) => {
            const gerenteName    = eq.gerente    ? (eq.gerente.alias    || eq.gerente.nombre    || '?') : null
            const supervisorName = eq.supervisor ? (eq.supervisor.alias || eq.supervisor.nombre || '?') : null
            const unassignedForThis = allMiembros.filter(
              (m) => m.rol === 'vendedor' && !assignedIds.has(m.user_id),
            )

            return (
              <Card key={eq.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{eq.nombre}</h3>
                    <div className="mt-0.5 text-xs text-muted-foreground space-x-3">
                      {gerenteName    && <span>Gerente: <span className="text-foreground">{gerenteName}</span></span>}
                      {supervisorName && <span>Supervisor: <span className="text-foreground">{supervisorName}</span></span>}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="ghost" className="h-7 gap-1.5 text-muted-foreground"
                    onClick={() => openEdit(eq)}
                  >
                    <Pencil className="size-3.5" />Editar
                  </Button>
                </div>

                {/* Members */}
                <div className="flex flex-wrap gap-1.5">
                  {eq.vendedores.map((v) => {
                    const name = v.alias || v.nombre || '?'
                    return (
                      <div
                        key={v.user_id}
                        className="flex items-center gap-1 bg-muted rounded-full pl-1.5 pr-2 py-0.5"
                      >
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                          {getInitials(name)}
                        </div>
                        <span className="text-xs">{name}</span>
                        <button
                          className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleRemoveMember(eq.id, v.user_id)}
                          disabled={isPending}
                          title="Quitar del equipo"
                        >
                          <UserMinus className="size-3" />
                        </button>
                      </div>
                    )
                  })}

                  {/* Add member dropdown */}
                  {unassignedForThis.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(userId) => userId && handleAddMember(eq.id, userId)}
                    >
                      <SelectTrigger className="h-6 w-auto border-dashed text-xs gap-1 pl-2 pr-2 rounded-full">
                        <Plus className="size-3" />
                        <span>Agregar</span>
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedForThis.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.alias || m.nombre || m.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {eq.vendedores.length === 0 && unassignedForThis.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Sin miembros asignados</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar equipo' : 'Nuevo equipo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Equipo Norte"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            {gerentes.length > 0 && (
              <div className="space-y-1.5">
                <Label>Gerente</Label>
                <Select
                  value={form.gerente_id || NONE}
                  onValueChange={(v) => setForm((f) => ({ ...f, gerente_id: v === NONE ? '' : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sin gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin gerente</SelectItem>
                    {gerentes.map((g) => (
                      <SelectItem key={g.user_id} value={g.user_id}>
                        {g.alias || g.nombre || g.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {supervisors.length > 0 && (
              <div className="space-y-1.5">
                <Label>Supervisor</Label>
                <Select
                  value={form.supervisor_id || NONE}
                  onValueChange={(v) => setForm((f) => ({ ...f, supervisor_id: v === NONE ? '' : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sin supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin supervisor</SelectItem>
                    {supervisors.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.alias || s.nombre || s.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.nombre.trim() || isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
