'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Trash2, Loader2, ImageIcon, Link2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { uploadTenantLogo, removeTenantLogo, setLogoUrl } from '@/app/actions/platform'

interface LogoUploadProps {
  tenantId:   string
  currentUrl: string | null
}

export function LogoUpload({ tenantId, currentUrl }: LogoUploadProps) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview,   setPreview]   = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [removing,  setRemoving]  = useState(false)

  // URL directa
  const [urlInput,   setUrlInput]   = useState(currentUrl ?? '')
  const [savingUrl,  setSavingUrl]  = useState(false)

  // ── Subir archivo ────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('logo', file)

    setUploading(true)
    const result = await uploadTenantLogo(tenantId, formData)
    setUploading(false)

    if (!result.success) {
      toast.error('Error al subir el logo', { description: result.error })
      setPreview(currentUrl)
      return
    }

    setPreview(result.data.url)
    setUrlInput(result.data.url)
    toast.success('Logo actualizado')
    router.refresh()
    e.target.value = ''
  }

  // ── Guardar URL directa ───────────────────────────────────────
  async function handleSaveUrl() {
    const trimmed = urlInput.trim()
    setSavingUrl(true)
    const result = await setLogoUrl(tenantId, trimmed || null)
    setSavingUrl(false)

    if (!result.success) {
      toast.error('No se pudo guardar la URL')
      return
    }

    setPreview(trimmed || null)
    toast.success('Logo actualizado')
    router.refresh()
  }

  // ── Quitar logo ───────────────────────────────────────────────
  async function handleRemove() {
    setRemoving(true)
    const result = await removeTenantLogo(tenantId)
    setRemoving(false)

    if (!result.success) {
      toast.error('No se pudo quitar el logo', { description: result.error })
      return
    }

    setPreview(null)
    setUrlInput('')
    toast.success('Logo eliminado')
    router.refresh()
  }

  const isBusy = uploading || removing || savingUrl

  return (
    <div className="space-y-4">
      {/* Preview + botones de archivo */}
      <div className="flex items-center gap-4">
        {/* Preview — fondo blanco para logos oscuros */}
        <div className="h-16 w-48 rounded-lg bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden px-3 py-2">
          {preview ? (
            <img
              src={preview}
              alt="Logo de la concesionaria"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
              <ImageIcon className="size-5" />
              <span className="text-[10px]">Sin logo</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {uploading
              ? <><Loader2 className="size-3.5 animate-spin" />Subiendo...</>
              : <><Upload className="size-3.5" />Subir archivo</>}
          </Button>

          {preview && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={handleRemove}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              {removing
                ? <><Loader2 className="size-3.5 animate-spin" />Quitando...</>
                : <><Trash2 className="size-3.5" />Quitar logo</>}
            </Button>
          )}
        </div>
      </div>

      {/* URL directa */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="size-3" />
          <span>O pegá una URL directa (ej: <code className="font-mono">/main-icon-luxmar.png</code>)</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="/logo.png  ó  https://..."
            className="h-8 text-xs font-mono"
            disabled={isBusy}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUrl() }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || urlInput.trim() === (preview ?? '')}
            onClick={handleSaveUrl}
            className="h-8 gap-1 shrink-0"
          >
            {savingUrl
              ? <Loader2 className="size-3.5 animate-spin" />
              : <><Check className="size-3.5" />Guardar</>}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Archivo: SVG, PNG, JPG o WebP · máx. 5 MB.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
