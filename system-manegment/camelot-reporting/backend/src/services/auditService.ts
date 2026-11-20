import { Request } from 'express';
import { env } from '../config/env';
import { AuditLog } from '../models/AuditLog';
import { newId } from '../lib/ids';

export interface AuditActor {
  id: string;
  name: string;
}

export async function writeAudit(input: {
  req?: Request;
  actor?: AuditActor;
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  changes?: unknown;
}): Promise<void> {
  const user = input.actor ?? (input.req as Request & { user?: AuditActor })?.user;
  try {
    await AuditLog.create({
      _id: newId('audit'),
      organizationId: env.organisationId,
      userId: user?.id ?? '',
      userName: user?.name ?? 'system',
      action: input.action,
      entityType: input.entityType ?? '',
      entityId: input.entityId ?? '',
      description: input.description ?? '',
      changes: input.changes ?? null,
      ip: input.req?.ip ?? '',
      userAgent: input.req?.get('user-agent') ?? '',
      createdAt: new Date(),
    });
  } catch (error) {
    // Auditing must never break the primary operation, but it must be visible.
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log', error);
  }
}
