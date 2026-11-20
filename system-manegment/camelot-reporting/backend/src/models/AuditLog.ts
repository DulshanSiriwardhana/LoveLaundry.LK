import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions } from './common';

const auditLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, default: '' },
    userName: { type: String, default: '' },
    action: { type: String, required: true },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    description: { type: String, default: '' },
    changes: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  baseOptions,
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 }, { name: 'ix_audit_recent' });
auditLogSchema.index({ entityType: 1, entityId: 1 }, { name: 'ix_audit_entity' });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { _id: string };
export const AuditLog = model('AuditLog', auditLogSchema, 'audit_logs');
