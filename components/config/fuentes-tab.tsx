'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import {
  createSourceCustom, toggleSourceCustom, deleteSourceCustom,
} from '@/app/actions/sources'
import { leadSourceValues } from '@/lib/schemas/leads'
import type { getSourcesCustom } from '@/app/actions/sources'

type SourceCustom = Awaited<ReturnType<typeof getSourcesCustom>>[number]

interface FuentesTabProps {
  initialSources: SourceCustom[]
}

export function FuentesTab({ initialSources }: FuentesTabProps) {
  const [sources,   setSources]  = useState<SourceCustom[]>(initialSources)
  const [newName,   setNewName]  = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    const name = newName.trim()
    if (!name) return

    startTransition(async () => {
      const res = await createSourceCustom(name)
      if (res.success) {
        toast.success('Fuente creada')
        setNewName('')
        if ('data' in res) {
          setSources((prev) => [...prev, { id: res.data.id, nombre: name, activo: true }])
        }
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleToggle(s: SourceCustom) {
    startTransition(async () => {
      const res = await toggleSourceCustom(s.id)
      if (res.success) {
        setSources((prev) => prev.map((x) => x.id === s.id ? { ...x, activo: !x.activo } : x))
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleDelete(s: SourceCustom) {
    startTransition(async () => {
      const res = await deleteSourceCustom(s.id)
      if (res.success) {
        setSources((prev) => prev.filter((x) => x.id !== s.id))
        toast.success('Fuente eliminada')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Built-in sources (read-only reference) */}
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Fuentes predeterminadas del sistema
        </p>
        <div className="flex flex-wrap gap-1.5">
          {leadSourceValues.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Estas fuentes siempre están disponibles y no se pueden modificar.
        </p>
      </Card>

      {/* Custom sources */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Fuentes personalizadas
        </p>

        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder="Ej: Instagram Direct, Feria Expo 2026..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            className="max-w-xs"
          />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleCreate}
            disabled={!newName.trim() || isPending}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Agregar
          </Button>
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay fuentes personalizadas. Agregá una para que aparezca junto a las predeterminadas.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">
                      {s.nombre}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={s.activo ? 'default' : 'secondary'} className="text-[10px]">
                        {s.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => handleToggle(s)}
                          disabled={isPending}
                          title={s.activo ? 'Desactivar' : 'Activar'}
                        >
                          {s.activo
                            ? <EyeOff className="size-3.5 text-muted-foreground" />
                            : <Eye className="size-3.5 text-success" />}
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => handleDelete(s)}
                          disabled={isPending}
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  )
}
