'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { requireTenant } from '@/lib/leads/server-helpers'

// ── getUnreadCount ────────────────────────────────────────────────────────────

export async function getUnreadCount(): Promise<number> {
  const { user, tenantId } = await requireTenant()

  const rows = await dbAdmin
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(and(
      eq(schema.notifications.tenant_id, tenantId),
      eq(schema.notifications.user_id,   user.id),
      isNull(schema.notifications.read_at),
    ))

  return rows.length
}

// ── getMyNotifications ────────────────────────────────────────────────────────

export async function getMyNotifications() {
  const { user, tenantId } = await requireTenant()

  return dbAdmin
    .select()
    .from(schema.notifications)
    .where(and(
      eq(schema.notifications.tenant_id, tenantId),
      eq(schema.notifications.user_id,   user.id),
    ))
    .orderBy(desc(schema.notifications.created_at))
    .limit(50)
}

// ── markRead ──────────────────────────────────────────────────────────────────

export async function markRead(notificationId: string) {
  const { user, tenantId } = await requireTenant()

  await dbAdmin
    .update(schema.notifications)
    .set({ read_at: new Date() })
    .where(and(
      eq(schema.notifications.id,        notificationId),
      eq(schema.notifications.user_id,   user.id),
      eq(schema.notifications.tenant_id, tenantId),
      isNull(schema.notifications.read_at),
    ))

  revalidatePath('/bandeja')
}

// ── markAllRead ───────────────────────────────────────────────────────────────

export async function markAllRead() {
  const { user, tenantId } = await requireTenant()

  await dbAdmin
    .update(schema.notifications)
    .set({ read_at: new Date() })
    .where(and(
      eq(schema.notifications.user_id,   user.id),
      eq(schema.notifications.tenant_id, tenantId),
      isNull(schema.notifications.read_at),
    ))

  revalidatePath('/bandeja')
}
