import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../lib/asyncHandler';
import { badRequest, forbidden, notFound, unauthorized } from '../lib/errors';
import { newId } from '../lib/ids';
import { requireAuth, requireRole, signToken } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { User } from '../models/User';
import { writeAudit } from '../services/auditService';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(200)
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: passwordSchema,
  role: z.enum(['admin', 'operator']).default('operator'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['admin', 'operator']).optional(),
  active: z.boolean().optional(),
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.active) throw unauthorized('Invalid email or password.');
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      await writeAudit({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user._id,
        description: `Failed sign-in for ${user.email}.`,
        req,
      });
      throw unauthorized('Invalid email or password.');
    }
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();
    await user.save();
    const token = signToken({
      sub: user._id,
      name: user.name,
      email: user.email,
      role: user.role as 'admin' | 'operator',
    });
    await writeAudit({
      req,
      actor: { id: user._id, name: user.name },
      action: 'LOGIN',
      entityType: 'user',
      entityId: user._id,
      description: `${user.name} signed in.`,
    });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(changePasswordSchema, req.body);
    const user = await User.findById(req.user!.id).select('+passwordHash');
    if (!user) throw notFound('User not found.');
    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) throw badRequest('The current password is incorrect.');
    if (body.currentPassword === body.newPassword) throw badRequest('Choose a password that is different from the current one.');
    user.passwordHash = await bcrypt.hash(body.newPassword, 12);
    user.updatedAt = new Date();
    await user.save();
    await writeAudit({
      req,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: user._id,
      description: `${user.name} changed their password.`,
    });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/users',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: 1 }).lean();
    res.json({ users });
  }),
);

authRouter.post(
  '/users',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(createUserSchema, req.body);
    const exists = await User.findOne({ email: body.email.toLowerCase() });
    if (exists) throw badRequest('A user with this email already exists.');
    const user = await User.create({
      _id: newId('user'),
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(body.password, 12),
      role: body.role,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await writeAudit({
      req,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user._id,
      description: `Created ${user.role} user ${user.email}.`,
    });
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active } });
  }),
);

authRouter.patch(
  '/users/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateUserSchema, req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found.');
    if (user._id === req.user!.id && body.active === false) throw forbidden('You cannot deactivate your own account.');
    if (user._id === req.user!.id && body.role && body.role !== 'admin') {
      throw forbidden('You cannot remove your own admin access.');
    }
    if (body.name !== undefined) user.name = body.name;
    if (body.role !== undefined) user.role = body.role;
    if (body.active !== undefined) user.active = body.active;
    user.updatedAt = new Date();
    await user.save();
    await writeAudit({
      req,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: user._id,
      description: `Updated user ${user.email}.`,
      changes: body,
    });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active } });
  }),
);

authRouter.post(
  '/users/:id/reset-password',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(z.object({ newPassword: passwordSchema }), req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found.');
    user.passwordHash = await bcrypt.hash(body.newPassword, 12);
    user.updatedAt = new Date();
    await user.save();
    await writeAudit({
      req,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: user._id,
      description: `Admin reset password for ${user.email}.`,
    });
    res.json({ ok: true });
  }),
);

// Exported for documentation / potential CLI use.
export const bootstrapCredentials = {
  adminEmail: env.admin.email,
  operatorEmail: env.operator.email,
};
