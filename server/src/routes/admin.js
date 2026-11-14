import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, credits: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ users });
  } catch (error) { next(error); }
});

router.post('/grant-credits', async (req, res, next) => {
  try {
    const { email, credits } = z.object({
      email: z.string().email(),
      credits: z.number().int().min(1).max(10000)
    }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: { credits: { increment: credits } },
        select: { id: true, name: true, email: true, credits: true }
      });
      await tx.creditLedger.create({
        data: { userId: user.id, amount: credits, type: 'ADMIN_GRANT', note: 'Admin credit grant' }
      });
      return result;
    });
    res.json({ user: updated });
  } catch (error) { next(error); }
});

export default router;
