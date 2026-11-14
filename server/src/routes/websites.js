import { Router } from 'express';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'missing-key' });

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { prompt } = z.object({
      prompt: z.string().trim().min(12).max(3000)
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.credits < 1) return res.status(402).json({ error: 'You are out of credits. Buy more to generate a website.' });
    if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'AI is not configured yet. Add GROQ_API_KEY to server/.env.' });

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.35,
      max_tokens: 5000,
      messages: [
        {
          role: 'system',
          content: `You are an expert frontend developer. Generate a complete, attractive, responsive single-page website.
Return ONLY a complete HTML document, with inline CSS and vanilla JavaScript. Do not use markdown fences.
Use semantic HTML, accessible contrast, mobile responsive layout, polished spacing and typography.
Do not include external scripts, trackers, forms that submit to real services, or requests for secrets.
All CSS must be inside a style tag. Any JavaScript must be inside a script tag.
Make the website content match the user's prompt.`
        },
        { role: 'user', content: prompt }
      ]
    });

    let html = completion.choices?.[0]?.message?.content?.trim() || '';
    html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (!html.toLowerCase().includes('<html') || !html.toLowerCase().includes('</html>')) {
      throw new Error('The AI did not return a complete HTML document. Please try a more specific prompt.');
    }
    // Store output and spend one credit atomically. Conditional update prevents concurrent overspending.
    const website = await prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: req.user.id, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } }
      });
      if (debit.count !== 1) throw new Error('NO_CREDITS');
      const created = await tx.website.create({
        data: {
          userId: req.user.id,
          title: prompt.slice(0, 70),
          prompt,
          html
        }
      });
      await tx.creditLedger.create({
        data: { userId: req.user.id, amount: -1, type: 'GENERATION', note: 'Website generation' }
      });
      const updatedUser = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { credits: true }
      });
      return { ...created, creditsRemaining: updatedUser.credits };
    });
    res.status(201).json({ website });
  } catch (error) {
    if (error.message === 'NO_CREDITS') return res.status(402).json({ error: 'You are out of credits.' });
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const websites = await prisma.website.findMany({
      where: { userId: req.user.id },
      select: { id: true, title: true, prompt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ websites });
  } catch (error) { next(error); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!website) return res.status(404).json({ error: 'Website not found.' });
    res.json({ website });
  } catch (error) { next(error); }
});

export default router;
