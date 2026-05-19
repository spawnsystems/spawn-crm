/**
 * Placeholder de login — se implementa en Fase 2 (Auth con Supabase).
 * Por ahora deja la ruta reservada para que el middleware/proxy no rompa
 * cuando redirige a /login.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
          S
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Spawn CRM</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Login en construcción · Fase 2
        </p>
      </div>
    </main>
  )
}
