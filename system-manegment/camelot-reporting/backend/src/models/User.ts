import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'operator'], default: 'operator' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    ...timestampsDefinition,
  },
  baseOptions,
);

userSchema.index({ email: 1 }, { unique: true, name: 'uq_user_email' });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string };
export const User = model('User', userSchema, 'users');
