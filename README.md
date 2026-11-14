# AI Website Builder (PERN + Groq + Stripe)

A beginner-friendly full-stack starter:
- React + Vite frontend (plain JavaScript)
- Express + Node.js API
- PostgreSQL + Prisma ORM
- Groq API for AI-generated HTML (choose a currently available model in `.env`)
- Credit ledger: each successful generation spends 1 credit
- Stripe Checkout + verified webhook to add credits after payment
- Admin role and admin credit-management endpoint

## 1. Requirements
Install:
- Node.js 20+
- PostgreSQL 14+
- Git (optional)
- VS Code (recommended)

Create a PostgreSQL database named `ai_builder` (or use a hosted PostgreSQL URL).

## 2. Configure the backend
```bash
cd server
npm install
cp .env.example .env
```
Open `server/.env` and set:
- `DATABASE_URL` to your PostgreSQL connection string
- `JWT_SECRET` to a long random secret
- `GROQ_API_KEY` from https://console.groq.com/
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` if you have an eligible Stripe account
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first admin account

Then run:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```
API runs at http://localhost:5000.

The first admin user is created/updated by the seed script. Keep its password private.

## 3. Configure the frontend
Open a second terminal:
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL shown (normally http://localhost:5173).

## 4. Test the AI generator
1. Register a normal user.
2. Sign in.
3. Enter a prompt such as: "Create a modern one-page bakery website with a hero, menu cards, about section and contact footer. Use warm cream and brown colors."
4. Click Generate. One credit is deducted only after a successful AI response and saved result.

Groq free access and model availability/rate limits can change. Set `GROQ_MODEL` in `.env` to a model currently enabled for your Groq account. Never put the Groq key in the React app.

## 5. Stripe payments (optional until keys are configured)
This project uses Stripe-hosted Checkout. Configure the Stripe keys, then start a local webhook listener:
```bash
# Install Stripe CLI, then:
stripe login
stripe listen --forward-to localhost:5000/api/payments/webhook
```
Copy the webhook signing secret printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET`, restart the server, and test a purchase from the Credits page.

For production, create a webhook endpoint in Stripe Dashboard at:
`https://YOUR_API_DOMAIN/api/payments/webhook`
Subscribe to `checkout.session.completed`. Use the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

The server verifies webhook signatures and records processed Stripe event IDs, preventing duplicate credit grants. Never grant credits based only on the success redirect.

### Important India note
As of November 2026, Stripe says new Stripe accounts in India are invite-only. Existing/eligible accounts can use the integration, subject to Stripe's onboarding and business requirements. Stripe India does not support UPI/local netbanking through this integration. Check current eligibility before building your business around Stripe. You can develop the app with payments disabled meanwhile.

## 6. Admin
The seeded admin can:
- See the admin panel
- Grant credits to a user using their email and a positive integer amount

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding. Do not expose admin credentials in frontend code.

## 7. Production checklist
Before launch:
- Use HTTPS and strong unique secrets.
- Set exact frontend/API origins in `CLIENT_URL` and `VITE_API_URL`.
- Use managed PostgreSQL with backups.
- Configure Stripe live keys and production webhook endpoint.
- Add email verification, password reset, abuse/rate limiting, logging, monitoring and terms/privacy/refund policies.
- Add AI output moderation and stronger HTML sanitization before allowing public publishing.
- Review tax, consumer, privacy and payment compliance with a qualified professional.
- Do not store card details; Stripe Checkout handles payment data.

This is a working learning starter, not a production-audited SaaS.
