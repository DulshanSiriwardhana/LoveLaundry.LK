import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions } from './common';

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  baseOptions,
);

export type CounterDoc = InferSchemaType<typeof counterSchema> & { _id: string };
export const Counter = model('Counter', counterSchema, 'counters');
