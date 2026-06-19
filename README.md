# DropGuard AIO Product Monitoring Prototype

DropGuard is a client-ready prototype for a compliant AIO-style product drop monitoring and checkout assistance tool. It demonstrates the proposed dashboard, monitoring workflow, alerting flow, user profiles, event logging, and policy guardrails without performing live automation against third-party websites.

## Demo Features

- Product drop monitoring dashboard for scheduled releases.
- Shopify and WooCommerce-style monitor tasks.
- Keyword, size, color, and variant preferences.
- Fast in-app alert simulation with event logs.
- Discord, email, SMS, and in-app alert channel controls.
- Account/profile preference cards.
- Checkout assistance preview that keeps the user in control.
- Clear compliance guardrails: no CAPTCHA bypass, no queue bypass, no protected data scraping, no unsafe payment behavior.
- Dependency-free local demo server.

## Run Locally

Requirements:

- Node.js 18 or newer.

Start the prototype:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

You can also open `index.html` directly in a browser, but `npm start` is better for a client demo.

## Client Demo Script

1. Open the dashboard and explain that this is the MVP control panel for product monitoring and checkout assistance.
2. Click `Simulate Live Drop` to show product-live detection, alert delivery, metric updates, and event logging.
3. Click `Add Demo Task` to show how a new Shopify monitor would be configured.
4. Show profile preferences for size, color, and alert priority.
5. Click `Launch Checkout Assist Preview` and explain that the system only assists where permitted and always leaves final checkout/payment to the user.
6. Point out the compliance guardrails section.

## Recommended Production Stack

- Frontend: Next.js, React, Tailwind CSS.
- Backend API: Node.js with Fastify or Python with FastAPI.
- Worker engine: Playwright for approved browser workflows, plus public APIs where available.
- Database: PostgreSQL for production, SQLite for early MVP testing.
- Realtime alerts: WebSocket or Server-Sent Events for dashboard updates.
- External notifications: Discord webhooks first, then email/SMS.
- Observability: structured logs, task history, error tracking.
- Deployment: Docker containers on a VPS or managed cloud service.

## MVP Build Plan

Phase 1, prototype to working MVP:

- Build monitor CRUD, profiles, alert channels, and logs.
- Implement Shopify public product monitoring adapter.
- Add scheduled checks and live event dispatch.
- Add Discord webhook notifications.
- Add allowed checkout-assist flow that opens the product/cart page and stops at protected states.

Phase 2, production hardening:

- Add user authentication and profile encryption.
- Add PostgreSQL persistence.
- Add adapter configuration for additional supported websites.
- Add retry rules, rate limits, and per-site policy settings.
- Add test coverage for adapters, alerts, and task scheduling.

## Estimated Timeline

- Polished clickable prototype: 1-2 days.
- Working MVP with Shopify monitoring, dashboard, profiles, logs, and Discord alerts: 2-4 weeks.
- Multi-site support and production hardening: 4-8 additional weeks depending on target sites and compliance requirements.

## Compliance Position

This project should be built around allowed access and human-controlled checkout assistance. It should not include CAPTCHA bypass, queue bypass, credential theft, payment fraud, private data scraping, malware, or attempts to evade website protections. Each supported site should have a dedicated adapter with clear policy rules before enabling automation.

## Prototype Files

- `index.html`: dashboard structure.
- `styles.css`: responsive visual design.
- `app.js`: simulated monitor, alert, log, and profile interactions.
- `server.mjs`: dependency-free static server.
- `package.json`: local run scripts.
