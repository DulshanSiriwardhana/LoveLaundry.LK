import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route matches ${req.method} ${req.originalUrl}.` } });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details ?? null },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (error instanceof MulterError) {
    res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? `The file is larger than the ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB limit.`
            : error.message,
      },
    });
    return;
  }
  const mongoError = error as { code?: number; keyValue?: Record<string, unknown>; message?: string };
  if (mongoError?.code === 11000) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: 'A record with these unique values already exists.',
        details: mongoError.keyValue ?? null,
      },
    });
    return;
  }
  if (mongoError?.message?.includes('Cast to')) {
    res.status(400).json({ error: { code: 'INVALID_VALUE', message: mongoError.message } });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction ? 'An unexpected server error occurred.' : String((error as Error)?.message ?? error),
    },
  });
}
