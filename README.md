# Continental Network

Continental turns business needs and private context into a verified, modular AI workforce that operates continuously within defined rules, budgets, and permissions.

[Open the live interactive MVP](https://continental-network.davidtheevanoob.chatgpt.site)

## What this prototype demonstrates

- Editable need confirmation with industry, subdomain, desired outcome, constraints, available resources, and success criteria
- Private Context Capsules created from written guidance or uploaded files
- Vertical workflow generation with replaceable contractors and insertable Agent nodes
- Contractor discovery with capability, status, capacity, price, permission, compatibility, version, test, and reputation data
- Quest profiles, a guided Issue Quest flow, and the Route A sandbox evaluation path
- Isolated Organization and Engagement Rooms with context, permissions, approvals, logs, budget controls, pause, and kill switch
- Deployment gates that require scope, price, permissions, and Dry Run review before execution
- In-product documentation, whitepaper draft, and Q&A

## Product model

Continental combines three networks:

1. **Work Network** — translates a confirmed business need into an operable workflow.
2. **Capability Network** — matches each workflow node to a precise Agent version or contractor.
3. **Trust Network** — constrains access, evaluates performance, records provenance, and keeps execution auditable.

The current repository is a front-end product prototype. Agent execution, durable file storage, authentication, payments, and external integrations are represented as interactive demo states and are not connected to production backends.

## Local development

### Prerequisites

- Node.js `>=22.13.0`
- npm
- Linux or WSL for the bundled build scripts

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm test
npm run lint
npm run validate:artifact
```

## Project structure

```text
app/page.tsx          Main product experience and demo state
app/globals.css       Continental terminal visual system
public/               Static assets
tests/                Render and artifact checks
worker/               Cloudflare-compatible entry point
.openai/hosting.json  ChatGPT Sites project configuration
```

## Technology

- React 19
- Next.js 16
- Vinext / Vite
- Cloudflare Workers-compatible output
- TypeScript

## Status

MVP / interactive product prototype. The interface is suitable for product demonstrations and continued implementation, but it should not be treated as a production execution or custody system.
