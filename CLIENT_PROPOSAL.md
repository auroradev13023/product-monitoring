# Client Proposal Notes

Hi, I built a small prototype to demonstrate how I would approach your AIO product drop monitoring and checkout assistance tool in a safe, compliant way.

## Relevant Approach

The prototype shows a clean dashboard for scheduled product releases, keyword monitoring, variant preferences, alert routing, profiles, logs, and checkout assistance. The checkout flow is intentionally human-controlled and policy-aware: it does not bypass CAPTCHA, queues, payment protections, or private data restrictions.

## Recommended Tech Stack

- Frontend: Next.js, React, Tailwind CSS.
- Backend: FastAPI or Node.js/Fastify.
- Monitoring worker: Playwright where browser automation is allowed, plus public platform APIs where available.
- Database: PostgreSQL for production, SQLite for MVP testing.
- Alerts: Discord webhook first, then email/SMS.
- Deployment: Dockerized services on a VPS or managed cloud platform.

## MVP Timeline

- Prototype/demo UI: complete.
- Working Shopify-focused MVP: 2-4 weeks.
- Additional platforms, production hardening, and maintenance tooling: 4-8 additional weeks depending on the target websites.

## Ongoing Support

I can provide ongoing adapter updates, monitoring reliability improvements, dashboard enhancements, deployment support, and maintenance as supported websites change their storefront behavior or policies.

## Important Compliance Boundary

The build should only support allowed monitoring and checkout assistance. I will not implement CAPTCHA bypass, queue bypass, protected data scraping, payment fraud, credential theft, malware, or any feature designed to evade a website's terms or protections.
