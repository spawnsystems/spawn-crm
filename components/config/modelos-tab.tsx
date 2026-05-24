'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, EyeOff, Eye, Loader2, Car } from 'lucide-react'
import { createModelo, updateModelo, toggleModeloActivo } from '@/app/actions/modelos'
import { formatCurrencyARS } from '@/lib/utils'
import type { getModelosVehiculo } from '@/app/actions/modelos'

type Modelo = Awaited<ReturnType<typeof getModelosVehiculo>>[number]

interface ModelosTabProps {
  initialModelos: Modelo[]
}

const EMPTY_FORM = { nombre: '', motor: '', transmision: '', consumo: '', precio: '', stock: '' }

export function ModelosTab({ initialModelos }: ModelosTabProps) {
  const [modelos,    setModelos]    = useState<Modelo[]>(initialModelos)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing,    setEditing]    = useState<Modelo | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Modelo | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(m: Modelo) {
    setEditing(m)
    setForm({
      nombre:      m.nombre,
      motor:       m.motor       ?? '',
      transmision: m.transmision ?? '',
      consumo:     m.consumo     ?? '',
      precio:      m.precio      ?? '',
      stock:       String(m.stock ?? ''),
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.nombre.trim()) return

    // Valores normalizados: null en lugar de undefined para coincidir con el tipo Modelo
    const actionPayload = {
      nombre:      form.nombre,
      motor:       form.motor       || undefined,
      transmision: form.transmision || undefined,
      consumo:     form.consumo     || undefined,
      precio:      form.precio      ? Number(form.precio) : undefined,
      stock:       form.stock       ? Number(form.stock)  : undefined,
    }

    // Snapshot para el optimistic update (misma forma que Modelo, null en vez de undefined)
    const optimistic = {
      nombre:      form.nombre,
      motor:       form.motor       || null,
      transmision: form.transmision || null,
      consumo:     form.consumo     || null,
      precio:      form.precio      ? form.precio        : null,
      stock:       form.stock       ? Number(form.stock) : 0,
    } as const

    startTransition(async () => {
      if (editing) {
        const res = await updateModelo(editing.id, actionPayload)
        if (res.success) {
          toast.success('Modelo actualizado')
          setDialogOpen(false)
          const snapId = editing.id
          setModelos((prev) =>
            prev.map((m) =>
              m.id === snapId ? { ...m, ...optimistic } : m,
            ),
          )
        } else {
          toast.error(res.error)
        }
      } else {
        const res = await createModelo(actionPayload)
        if (res.success) {
          toast.success('Modelo creado')
          setDialogOpen(false)
          setModelos((prev) => [
            ...prev,
            { id: res.data.id, activo: true, ...optimistic },
          ])
        } else {
          toast.error(res.error)
        }
      }
    })
  }

  function handleToggle(m: Modelo) {
    startTransition(async () => {
      const res = await toggleModeloActivo(m.id)
      if (res.success) {
        setModelos((prev) => prev.map((x) => x.id === m.id ? { ...x, activo: !x.activo } : x))
        toast.success(m.activo ? 'Modelo desactivado' : 'Modelo activado')
      } else {
        toast.error(res.error)
      }
      setToggleTarget(null)
    })
  }

  const activos   = modelos.filter((m) => m.activo)
  const inactivos = modelos.filter((m) => !m.activo)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {activos.length} modelo{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}
            {inactivos.length > 0 && ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-3.5" />Nuevo modelo
        </Button>
      </div>

      {/* Table */}
      {modelos.length === 0 ? (
        <Card className="p-8 text-center">
          <Car className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay modelos todavía. Creá el primero para que los vendedores puedan seleccionarlo al cargar un lead.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Motor</th>
                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Precio</th>
                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Stock</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    {m.nombre}
                    {m.transmision && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{m.transmision}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {m.motor ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {formatCurrencyARS(m.precio, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {m.stock ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.activo ? 'default' : 'secondary'} className="text-[10px]">
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => setToggleTarget(m)}
                        disabled={isPending}
                      >
                        {m.activo
                          ? <EyeOff className="size-3.5 text-muted-foreground" />
                          : <Eye className="size-3.5 text-success" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar modelo' : 'Nuevo modelo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Tracker Premier"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Motor</Label>
                <Input
                  placeholder="Ej: 1.2T Turbo"
                  value={form.motor}
                  onChange={(e) => setForm((f) => ({ ...f, motor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Transmisión</Label>
                <Input
                  placeholder="Ej: Aut. 6 vel"
                  value={form.transmision}
                  onChange={(e) => setForm((f) => ({ ...f, transmision: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Precio (ARS)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.precio}
                  onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stock</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Consumo</Label>
              <Input
                placeholder="Ej: 13.5 km/l"
                value={form.consumo}
                onChange={(e) => setForm((f) => ({ ...f, consumo: e.target.value }))}
              />
            </div>
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

      {/* Toggle confirm */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(v) => { if (!v) setToggleTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.activo ? 'Desactivar modelo' : 'Activar modelo'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.activo
                ? `"${toggleTarget.nombre}" dejará de aparecer en el selector de nuevos leads.`
                : `"${toggleTarget?.nombre}" volverá a aparecer en el selector de nuevos leads.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleTarget && handleToggle(toggleTarget)}>
              {toggleTarget?.activo ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
