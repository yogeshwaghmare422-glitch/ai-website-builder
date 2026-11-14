import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import websiteRoutes from './routes/websites.js';
import paymentRoutes, { stripeWebhook } from './routes/payments.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

// Must come before express.json(): Stripe signature verification needs the raw body.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid input.' });
  if (err.code === 'P2002') return res.status(409).json({ error: 'This record already exists.' });
  res.status(500).json({ error: err.message || 'Server error.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`API running at http://localhost:${port}`));
