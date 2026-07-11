# FluxRoute ⚡

![CI](https://github.com/Sorostar-Hub/FluxRoute/actions/workflows/ci.yml/badge.svg)
![Contract Tests](https://github.com/Sorostar-Hub/FluxRoute/actions/workflows/contract-test.yml/badge.svg)

> Cross-protocol intent aggregation layer for the Stellar ecosystem.

Users express **what** they want — swap, convert, route, pay — and FluxRoute finds and executes the optimal path across Soroswap, Blend, DeFindex, and Stellar's native path payments. Sign once. Pay once.

**Live Testnet Deployment:**
- IntentRegistry: [`CAX4Q2AQCQBQ5GBCPPUZO5HID2EBRZBQEVBNRDVDNZYGRC6DXT7EBIW4`](https://stellar.expert/explorer/testnet/contract/CAX4Q2AQCQBQ5GBCPPUZO5HID2EBRZBQEVBNRDVDNZYGRC6DXT7EBIW4)
- SolverSettlement: [`CCBKB2QTOGVVVFS6TDGCKYOXYDCHIBKWMCZAUZKOXBLVVUAIVWJ6IMQP`](https://stellar.expert/explorer/testnet/contract/CCBKB2QTOGVVVFS6TDGCKYOXYDCHIBKWMCZAUZKOXBLVVUAIVWJ6IMQP)

---

## 💡 What is FluxRoute?

FluxRoute is a next-generation **intent-based routing protocol** built on Stellar. Instead of manually specifying execution paths across multiple protocols, users describe their intent ("I want to convert 100 USDC to BRL"), and FluxRoute's decentralized solver network competes to find and execute the best route.

### Key Concepts:

- **Intent-Centric**: Users specify outcomes, not execution paths
- **Cross-Protocol**: Routes through Soroswap, Blend, DeFindex, and Stellar Path Payments
- **Solver Network**: Off-chain solvers compete to fill intents at the best price
- **Atomic Settlement**: Soroban smart contracts guarantee all-or-nothing execution
- **One-Click**: Sign once, execute once — no hop-by-hop approvals
- **Slippage Protection**: Built-in protection against unfavorable fills

### Architecture Pattern:

FluxRoute follows an **intent-solver-settlement** model:
1. **Intent** → User expresses desired outcome on-chain
2. **Solver Competition** → Off-chain nodes bid to fulfill the intent
3. **Route Optimization** → Best path identified across protocols
4. **Atomic Settlement** → Soroban contract executes atomically
5. **Outcome** → User receives desired asset with price protection

---

## Status

✅ **Testnet Alpha — Contracts Deployed & Verified**

| Milestone | Status |
|---|---|
| **M1 — Contracts Live** | ✅ Both Soroban contracts deployed and initialized on testnet |
| **M2 — Frontend Live** | ✅ Next.js dApp with Freighter wallet connect (deploy to Vercel via `vercel.json`) |
| **M3 — SDK Published** | ✅ `@fluxroute/sdk` implemented with 44 tests (92% utils coverage) |
| **M4 — Solver Running** | ✅ Solver node with Soroswap + Path Payment strategies + Prometheus metrics |

---

## 🏗️ Architecture Overview

```
User Intent
    │
    ▼
Intent Registry (Soroban) ── stores intent on-chain
    │
    ▼
Solver Network ── off-chain nodes compete to fill
    │
    ▼
Route Optimizer ── best path across:
    ├── Soroswap
    ├── Blend
    ├── DeFindex
    └── Stellar Path Payments
    │
    ▼
Settlement Contract (Soroban) ── atomic execution
    │
    ▼
Outcome delivered to recipient
```

---

## 📁 Repo Structure

```
fluxroute/
│
├── contracts/                        # Soroban smart contracts (Rust)
│   ├── Cargo.toml                    # Workspace manifest
│   ├── intent-registry/              # Stores & manages intents on-chain
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── intent.rs
│   │       ├── events.rs
│   │       └── errors.rs
│   ├── solver-settlement/            # Atomic settlement & slippage enforcement
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── settlement.rs
│   │       ├── verification.rs
│   │       └── errors.rs
│   └── lib/                          # Shared types across contracts
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── types.rs
│
├── packages/
│   ├── sdk/                          # TypeScript SDK (@fluxroute/sdk)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts             # FluxRouteClient — main entry point
│   │   │   ├── types/
│   │   │   │   ├── intent.ts
│   │   │   │   ├── solver.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── encoding.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── index.ts
│   │   │   └── hooks/
│   │   │       ├── useIntent.ts
│   │   │       └── useSolver.ts
│   │   └── examples/
│   │       ├── basic-swap.ts
│   │       └── cross-protocol-route.ts
│   │
│   ├── solver/                       # Off-chain solver daemon
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts
│   │       ├── solver.ts
│   │       ├── config.ts
│   │       ├── strategies/
│   │       │   ├── soroswap.ts
│   │       │   ├── blend.ts
│   │       │   ├── defindex.ts
│   │       │   └── path-payment.ts
│   │       ├── routing/
│   │       │   ├── graph.ts
│   │       │   ├── optimizer.ts
│   │       │   └── simulator.ts
│   │       └── monitoring/
│   │           ├── health.ts
│   │           └── metrics.ts
│   │
│   └── indexer/                      # On-chain event indexer + GraphQL API
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── src/
│           ├── index.ts
│           ├── processor.ts
│           ├── config.ts
│           ├── handlers/
│           │   ├── intent.ts
│           │   ├── settlement.ts
│           │   └── solver.ts
│           └── schema/
│               ├── schema.graphql
│               └── resolvers.ts
│
├── apps/
│   └── frontend/                     # Reference dApp (Next.js 14)
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       └── src/
│           ├── app/
│           │   ├── page.tsx
│           │   └── layout.tsx
│           ├── components/
│           │   ├── IntentForm.tsx
│           │   ├── SolverFeed.tsx
│           │   ├── RoutePreview.tsx
│           │   ├── StatusBadge.tsx
│           │   └── WalletConnect.tsx
│           ├── hooks/
│           │   ├── useFluxRoute.ts
│           │   └── useWallet.ts
│           └── lib/
│               ├── stellar.ts
│               └── constants.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── jest.integration.config.ts
│
├── scripts/
│   ├── deploy-contracts.sh
│   ├── setup-testnet.sh
│   ├── seed-solvers.sh
│   └── run-local.sh
│
├── docs/
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── intent-lifecycle.md
│   │   └── solver-network.md
│   └── adr/
│       ├── 001-intent-schema.md
│       ├── 002-solver-selection.md
│       └── 003-settlement-contract.md
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Root lint + test
│   │   ├── contract-test.yml         # Soroban contract tests
│   │   ├── frontend.yml              # Frontend CI/CD
│   │   ├── sdk.yml                   # SDK build + publish
│   │   ├── security.yml              # Security scanning
│   │   └── release.yml               # Release & npm publish
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── solver-integration.md
│   ├── CONTRIBUTING.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODE_OF_CONDUCT.md
│
├── jest.config.ts                    # Root Jest configuration
├── .eslintrc.json                    # Monorepo ESLint rules
├── .commitlintrc.json                # Conventional commits
├── lint-staged.config.js             # Pre-commit linting
├── docker-compose.yml                # Local dev environment
├── .husky/
│   ├── pre-commit                    # Pre-commit hooks
│   └── commit-msg                    # Commit message validation
├── package.json                      # Root — Turborepo workspaces
├── turbo.json
├── tsconfig.base.json
├── .prettierrc
├── .gitignore
├── .env.example
└── LICENSE                           # Apache 2.0
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| 📝 Smart Contracts | Rust + Soroban (Stellar Smart Contracts) |
| 📦 SDK | TypeScript, `@stellar/stellar-sdk` |
| ⚙️ Solver Node | TypeScript, Node.js |
| 🔍 Indexer | TypeScript, Apollo GraphQL, PostgreSQL |
| 🎨 Frontend | Next.js 14, Tailwind CSS, Freighter |
| 🏢 Monorepo | Turborepo |
| 🔄 CI/CD | GitHub Actions |

---

## 🔗 Integrated Protocols (planned)

- **[Soroswap](https://soroswap.finance)** — DEX swaps
- **[Blend](https://blend.capital)** — Lending & borrowing
- **[DeFindex](https://defindex.io)** — Yield vaults
- **Stellar Path Payments** — Native multi-hop routing

---

## 🗺️ Roadmap

### 🎯 Phase 1 — Foundation
- [x] Intent Registry Soroban contract (deployed on testnet)
- [x] Solver Settlement Soroban contract (deployed on testnet)
- [x] TypeScript SDK (`@fluxroute/sdk`) with hooks, validation, encoding
- [x] Soroswap + Path Payment solver strategies
- [x] Reference frontend (Next.js + Freighter)
- [x] Testnet deployment with CI/CD

### 🕸️ Phase 2 — Solver Network
- [ ] Blend, DeFindex strategies (stubs implemented)
- [ ] Solver registration & fee distribution
- [x] Indexer + GraphQL API
- [x] Solver monitoring dashboard (Prometheus metrics)

### 🚀 Phase 3 — Production
- [ ] Mainnet deployment
- [ ] SDK on npm
- [ ] Freighter wallet integration
- [ ] Multi-solver competition & slashing

---

## 📦 Project Bootstrap (Industrial Standards)

This project has been fully bootstrapped to **enterprise-grade development standards**. The following infrastructure is now in place:

### ✅ Configuration Files Added

| Config | Purpose |
|--------|---------|
| **`.eslintrc.json`** | Shared ESLint rules for TypeScript, React, Node.js across monorepo |
| **`jest.config.ts`** | Root Jest configuration with path mappings and coverage thresholds |
| **`.commitlintrc.json`** | Enforces conventional commit format (feat:, fix:, etc.) |
| **`lint-staged.config.js`** | Pre-commit linting for staged files |
| **`docker-compose.yml`** | Local development environment (PostgreSQL, Redis, Soroban testnet) |
| **`.husky/pre-commit`** | Pre-commit hook running linting & formatting |
| **`.husky/commit-msg`** | Commit message validation |

### ✅ Workflow Pipeline Added

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **`frontend.yml`** | Push/PR to `frontend/**` | Lint → Build → Test → E2E |
| **`sdk.yml`** | Push/PR to `packages/sdk/**` | Lint → Build → Test → Export validation |
| **`contract-test.yml`** | Push/PR to `contracts/**` | Cargo test → WASM build |
| **`security.yml`** | Weekly + each push | npm audit → CodeQL → cargo audit |
| **`release.yml`** | Tag push (sdk-v*, contract-v*) | SDK npm publish → Contract WASM upload |
| **`ci.yml`** | Push to main/develop | General lint + typecheck |

### ✅ Development Tooling

**Automated Pre-commit Checks:**
```bash
git commit -m "feat: new feature"
  ↓
.husky/pre-commit (runs lint-staged)
  ├─ ESLint --fix on TS/JS files
  ├─ Prettier on JSON/Markdown/YAML
  └─ cargo fmt on Rust files
  ↓
.husky/commit-msg (runs commitlint)
  └─ Validates message format
  ↓
✅ Commit accepted
```

**Local Development Stack:**
```bash
docker-compose up -d
  ├─ PostgreSQL 16 (indexer database)
  ├─ Redis 7 (caching)
  └─ Soroban Testnet (Stellar local network)
```

### ✅ Package.json Scripts Added

```bash
npm run lint                 # Run ESLint across monorepo
npm run lint:fix            # Auto-fix linting issues
npm run format:check        # Verify Prettier formatting
npm run type-check          # TypeScript type checking
npm run prepare             # Install Husky hooks
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Rust 1.75+ (for contracts)
- Docker & Docker Compose (for local environment)

### Environment Setup

1. **Clone & Install**
```bash
git clone https://github.com/your-org/fluxroute.git
cd fluxroute
npm install
npm run prepare  # Install Husky git hooks
```

2. **Start Local Environment**
```bash
docker-compose up -d
# Starts: PostgreSQL, Redis, Soroban testnet
```

3. **Development Commands**
```bash
# Watch mode for all packages
npm run dev

# Individual package dev
npm run dev:frontend
npm run dev:solver
npm run dev:indexer

# Testing
npm run test                 # All tests
npm run test:contracts      # Soroban contracts only
npm run test:integration    # Integration tests
npm run test:e2e            # E2E tests

# Code quality
npm run lint                 # Check linting
npm run lint:fix            # Auto-fix issues
npm run format:check        # Check formatting
npm run type-check          # TypeScript check
```

### Git Workflow

1. Create feature branch: `git checkout -b feat/my-feature`
2. Make changes (pre-commit hooks auto-format code)
3. Commit with conventional format: `git commit -m "feat: description"`
4. Push: `git push origin feat/my-feature`
5. Open PR → Workflows run automatically

---

## 🤝 Contributing

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).

Good first issues will be labeled [`good first issue`](../../issues?q=label%3A%22good+first+issue%22).
Solver integrations will be labeled [`solver-integration`](../../issues?q=label%3A%22solver-integration%22).

---

## 📜 License

[Apache 2.0](LICENSE)

---

*Built on Stellar. Powered by Soroban. Community-maintained.*
