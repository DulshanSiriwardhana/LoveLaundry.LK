import { SchemaDefinition, SchemaOptions } from 'mongoose';

/** Shared schema options: string ids, no __v, ISO dates. */
export const baseOptions: SchemaOptions = {
  versionKey: false,
  timestamps: false,
  minimize: false,
};

export const timestampsDefinition: SchemaDefinition = {
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

export const CURRENCY = 'LKR' as const;
export const TIMEZONE = 'Asia/Colombo' as const;
