export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Authentication required.') =>
  new ApiError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Resource not found.') => new ApiError(404, message, 'NOT_FOUND');
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, message, 'CONFLICT', details);
export const unprocessable = (message: string, details?: unknown) =>
  new ApiError(422, message, 'UNPROCESSABLE', details);
