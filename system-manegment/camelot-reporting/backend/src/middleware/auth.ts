import { NextFunction, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { User } from '../models/User';

export interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    const user = await User.findOne({ _id: decoded.sub, active: true }).lean();
    if (!user) throw unauthorized('This account is inactive or no longer exists.');
    req.user = { id: user._id, name: user.name, email: user.email, role: user.role as 'admin' | 'operator' };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Array<'admin' | 'operator'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden(`Requires ${roles.join(' or ')} access.`));
    next();
  };
}
