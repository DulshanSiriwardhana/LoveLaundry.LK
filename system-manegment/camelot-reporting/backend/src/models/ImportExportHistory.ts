import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions } from './common';

const operationErrorSchema = new Schema(
  {
    collection: { type: String, default: '' },
    message: { type: String, required: true },
    documentIndex: { type: Number, default: null },
    documentId: { type: String, default: null },
  },
  { _id: false },
);

const importExportHistorySchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    operation: {
      type: String,
      enum: ['import', 'export', 'backup', 'restore', 'dry_run'],
      required: true,
    },
    format: { type: String, default: '' },
    filename: { type: String, default: '' },
    mode: { type: String, default: '' },
    status: { type: String, enum: ['running', 'success', 'failed', 'partial'], default: 'running' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    collections: { type: [String], default: [] },
    recordsProcessed: { type: Number, default: 0 },
    recordsInserted: { type: Number, default: 0 },
    recordsUpdated: { type: Number, default: 0 },
    recordsSkipped: { type: Number, default: 0 },
    recordsFailed: { type: Number, default: 0 },
    recordsDeleted: { type: Number, default: 0 },
    errors: { type: [operationErrorSchema], default: [] },
    userId: { type: String, default: '' },
    userName: { type: String, default: '' },
    summary: { type: Schema.Types.Mixed, default: {} },
    manifest: { type: Schema.Types.Mixed, default: null },
  },
  baseOptions,
);

importExportHistorySchema.index({ organizationId: 1, startedAt: -1 }, { name: 'ix_io_history' });

export type ImportExportHistoryDoc = InferSchemaType<typeof importExportHistorySchema> & { _id: string };
export const ImportExportHistory = model(
  'ImportExportHistory',
  importExportHistorySchema,
  'import_export_history',
);
