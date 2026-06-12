# You Are The Loop 🎛️

A 60-second game about the hardest question in AI operations: **how much should you trust the AI?**

**▶ Play it:** https://claude.ai/public/artifacts/43bfc024-2c52-4a86-8e0a-ff8fa1b157b8 — the game needs no login; the "real AI" finale needs a free Claude account.

> "Human in the loop" isn't a philosophy. It's a number someone has to choose.

## The game

You run a customer support desk for one 60-second shift. Tickets stream in, each with a risk score from 0–100 (🟢 simple question · 🟡 money involved · 🔴 legal / fraud).

**One dial — AI autonomy — draws a line on that risk scale.** Everything in the AI zone gets handled by the bot alone. Everything riskier goes to your humans.

- Push the dial too far right → the AI mishandles risky cases. Incidents fire ("Bot refunds $1,280 to fraudster 🥷"), happiness drops, costs spike.
- Keep it too far left → your team drowns, the queue overflows, customers walk away.
- Halfway through, a Monday spike doubles the volume and forces you to adapt.

At the end you get a **shift report**: a grade, your stats, and a diagnosis of what actually decided your grade — too much trust, too little, or too expensive.

## The real-AI finale

After the game, type **any** support ticket. Claude (Anthropic's model) triages it live: intent, risk score, confidence, and a resolution-style draft reply. Your ticket gets pinned on the risk spectrum at its actual score — then you slide the boundary past it and watch the routing flip between *auto-resolved* and *human review* in real time.

That ten-second interaction is the whole thesis: moving the human in the loop is a one-number change — choosing the number is the job.

## Why I built it

I applied for an AI transformation role built around exactly this operating model — AI-led, human-orchestrated. I liked the idea enough to build a playable version of it over a weekend. The mechanics are a playful compression of patterns from my production-grade prototypes:

- [opspilot](https://github.com/gitsukrit/opspilot) — the same triage + rules + human-review architecture as a serious ops console
- [clinical-copilot](https://github.com/gitsukrit/clinical-copilot) — the full version: multi-tenant clinical triage with deterministic rule intercepts, two-tier human auditing, and immutable audit logs

## Honest scoping

This is a game, tuned for feel, not a simulator of any real support operation:

- Tickets, risk distribution (55% low / 30% medium / 15% high), incident probabilities, and the $0.40-AI vs $4-human cost model are **illustrative assumptions**, chosen to make the trade-off legible in 60 seconds.
- In the finale, Claude **invents plausible specifics** for its draft replies (rebooking options, refund timelines) — there is no real booking system behind it. A production version would ground replies in actual order data, with evaluation and drift monitoring on the risk scoring.
- The deeper version of these patterns — confidence-based routing, rules-after-AI, audit trails — lives in the repos linked above.

## Tech

Single-file React app built as a [Claude artifact](https://claude.ai): canvas-based simulation (requestAnimationFrame), React state, Tailwind, Anthropic Messages API with structured JSON output for the live triage. No backend, no storage.

## Author

**Sukrit Chakravarty** — 14+ years in regulated healthcare operations, building AI-enabled workflows with the human placed deliberately, not accidentally.
[LinkedIn](https://www.linkedin.com/in/sukrit-chakravarty-549016156) · [GitHub](https://github.com/gitsukrit)
