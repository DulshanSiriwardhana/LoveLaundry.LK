import { randomUUID } from 'crypto';

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}-${slugify(value)}`;
}
