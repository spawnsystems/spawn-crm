'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginatorProps {
  /** Página actual, base-1 */
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

/**
 * Controles de paginación reutilizables.
 * Se oculta automáticamente cuando hay una sola página.
 *
 * Ejemplo: "26–50 de 120   < 2 / 3 >"
 */
export function Paginator({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginatorProps) {
  if (totalPages <= 1) return null

  const from = Math.min((page - 1) * pageSize + 1, totalItems)
  const to   = Math.min(page * pageSize, totalItems)

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} de {totalItems}
      </span>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="min-w-[56px] text-center text-sm text-muted-foreground tabular-nums select-none">
          {page} / {totalPages}
        </span>

        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
