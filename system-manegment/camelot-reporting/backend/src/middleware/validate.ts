import { z, ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest(
      'Validation failed.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest(
      'Invalid query parameters.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format.');
export const serviceDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Date must use YYYY-MM-DD format.');

export const quantitySchema = z.number().int().min(0).max(1_000_000).nullable();
export const nonNegativeMoney = z.number().min(0).max(1_000_000_000);
export const optionalText = z.string().trim().max(2000).optional();
