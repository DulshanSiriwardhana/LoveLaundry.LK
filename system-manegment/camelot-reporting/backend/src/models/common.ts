import { SchemaDefinition, SchemaOptions } from 'mongoose';

/** Shared schema options: string ids, no __v, ISO dates. */
export const baseOptions = {
  versionKey: false,
  timestamps: false,
  minimize: false,
} satisfies SchemaOptions;

export const timestampsDefinition = {
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
} satisfies SchemaDefinition;

export const CURRENCY = 'LKR' as const;
export const TIMEZONE = 'Asia/Colombo' as const;
