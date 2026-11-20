import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET ?? 'development-only-insecure-secret';

if (nodeEnv === 'production' && jwtSecret === 'development-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set to a strong random value in production.');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 4100),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/camelot_reporting',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  admin: {
    name: process.env.ADMIN_NAME ?? 'Administrator',
    email: (process.env.ADMIN_EMAIL ?? 'admin@camelotbeach.lk').toLowerCase(),
    password: process.env.ADMIN_PASSWORD ?? 'ChangeMe!2026',
  },
  operator: {
    name: process.env.OPERATOR_NAME ?? 'Front Office',
    email: (process.env.OPERATOR_EMAIL ?? 'operator@camelotbeach.lk').toLowerCase(),
    password: process.env.OPERATOR_PASSWORD ?? 'Operator!2026',
  },
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Colombo',
  currency: process.env.APP_CURRENCY ?? 'LKR',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
  backupDir: path.resolve(process.cwd(), process.env.BACKUP_DIR ?? './storage/backups'),
  importDir: path.resolve(process.cwd(), process.env.IMPORT_DIR ?? './storage/imports'),
  trustProxy: bool(process.env.TRUST_PROXY),
  organisationId: 'love-laundry',
  customerId: 'camelot-beach-hotel',
};

export type AppEnv = typeof env;
