import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { monthKeySchema, parseBody, parseQuery, quantitySchema, serviceDateSchema } from '../middleware/validate';
import {
  copyDay,
  deleteDay,
  getDayEntry,
  getMatrix,
  saveDayEntries,
} from '../services/dailyService';
import { setDayCompletion } from '../services/reportService';

export const dailyRouter = Router();
dailyRouter.use(requireAuth);

dailyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({ month: monthKeySchema, date: serviceDateSchema }),
      req.query,
    );
    res.json(await getDayEntry(query.month, query.date));
  }),
);

dailyRouter.get(
  '/matrix',
  asyncHandler(async (req, res) => {
    const query = parseQuery(z.object({ month: monthKeySchema }), req.query);
    res.json(await getMatrix(query.month));
  }),
);

const saveSchema = z.object({
  month: monthKeySchema,
  entries: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: quantitySchema,
      }),
    )
    .max(500),
});

dailyRouter.put(
  '/:date',
  asyncHandler(async (req, res) => {
    const body = parseBody(saveSchema, req.body);
    const result = await saveDayEntries(body.month, req.params.date, body.entries, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json(result);
  }),
);

const copySchema = z.object({
  month: monthKeySchema,
  fromDate: serviceDateSchema,
  toDate: serviceDateSchema,
  overwrite: z.boolean().default(false),
  itemIds: z.array(z.string()).optional(),
});

dailyRouter.post(
  '/copy',
  asyncHandler(async (req, res) => {
    const body = parseBody(copySchema, req.body);
    const result = await copyDay(
      body.month,
      body.fromDate,
      body.toDate,
      { overwrite: body.overwrite, itemIds: body.itemIds },
      { id: req.user!.id, name: req.user!.name },
    );
    res.json(result);
  }),
);

dailyRouter.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        month: monthKeySchema,
        date: serviceDateSchema,
        completed: z.boolean(),
      }),
      req.body,
    );
    if (body.completed) {
      const day = await getDayEntry(body.month, body.date);
      if (day.rows.every((r) => !r.entered)) {
        res.status(400).json({
          error: {
            code: 'EMPTY_DAY',
            message: 'Add at least one quantity before marking the day complete.',
          },
        });
        return;
      }
    }
    const report = await setDayCompletion(body.month, body.date, body.completed, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({ completedDates: report.completedDates });
  }),
);

dailyRouter.delete(
  '/:date',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const query = parseQuery(z.object({ month: monthKeySchema }), req.query);
    const result = await deleteDay(query.month, req.params.date, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json(result);
  }),
);
