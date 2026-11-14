import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PACKAGES = {
  starter: { credits: 20, amount: 19900, label: '20 credits' },
  creator: { credits: 60, amount: 49900, label: '60 credits' },
  studio: { credits: 150, amount: 99900, label: '150 credits' }
};

router.get('/packages', (_req, res) => {
  const currency = (process.env.STRIPE_CURRENCY || 'inr').toLowerCase();
  res.json({
    currency,
    packages: Object.entries(PACKAGES).map(([id, p]) => ({
      id, credits: p.credits, label: p.label, amount: p.amount
    }))
  });
});

router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Payments are not configured. Add Stripe keys to server/.env.' });
    const { packageId } = z.object({ packageId: z.enum(['starter', 'creator', 'studio']) }).parse(req.body);
    const selected = PACKAGES[packageId];
    const currency = (process.env.STRIPE_CURRENCY || 'inr').toLowerCase();
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: selected.amount,
          product_data: { name: `AI Website Builder - ${selected.label}` }
        }
      }],
      metadata: {
        userId: user.id,
        packageId,
        credits: String(selected.credits)
      },
      success_url: `${process.env.CLIENT_URL}/credits?payment=success`,
      cancel_url: `${process.env.CLIENT_URL}/credits?payment=cancelled`
    });

    await prisma.payment.create({
      data: {
        stripeCheckoutSession: session.id,
        amount: selected.amount,
        currency,
        credits: selected.credits,
        userId: user.id
      }
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});

// Stripe sends raw request bytes; this route is mounted before express.json() in index.js.
export async function stripeWebhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const payment = await prisma.payment.findUnique({
        where: { stripeCheckoutSession: session.id }
      });
      if (payment && payment.status !== 'PAID') {
        await prisma.$transaction(async (tx) => {
          const alreadyHandled = await tx.payment.findFirst({ where: { stripeEventId: event.id } });
          if (alreadyHandled) return;
          await tx.user.update({
            where: { id: payment.userId },
            data: { credits: { increment: payment.credits } }
          });
          await tx.creditLedger.create({
            data: {
              userId: payment.userId,
              amount: payment.credits,
              type: 'PURCHASE',
              note: `Stripe purchase ${session.id}`
            }
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'PAID', stripeEventId: event.id }
          });
        });
      }
    }
  }
  res.json({ received: true });
}

export default router;
