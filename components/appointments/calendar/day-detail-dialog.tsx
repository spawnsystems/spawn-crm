'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { fmtDateKeyAR } from '@/lib/utils'
import { type ApptRow, apptStartMinutes } from './shared'
import { ApptCard } from './appt-visuals'

export function DayDetailDialog({
  date, appts, onClose, onApptClick,
}: {
  date:        Date | null
  appts:       ApptRow[]
  onClose:     () => void
  onApptClick: (a: ApptRow) => void
}) {
  const items = useMemo(() => {
    if (!date) return []
    const key = fmtDateKeyAR(date)
    return appts
      .filter((a) => fmtDateKeyAR(a.scheduled_at) === key)
      .sort((x, y) => apptStartMinutes(x.scheduled_at) - apptStartMinutes(y.scheduled_at))
  }, [date, appts])

  return (
    <Dialog open={!!date} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {date && format(date, "EEEE d 'de' MMMM", { locale: es })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin citas este día.</p>
          ) : (
            items.map((a) => (
              <ApptCard key={a.id} appt={a} onClick={() => onApptClick(a)} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
