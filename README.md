# FluxRoute ⚡

> Cross-protocol intent aggregation layer for the Stellar ecosystem.

Users express **what** they want — swap, convert, route, pay — and FluxRoute finds and executes the optimal path across Soroswap, Blend, DeFindex, and Stellar's native path payments. Sign once. Pay once.

---

## Status

🚧 **This project is under active scaffolding.** Implementation begins once the maintainer role is confirmed via the Stellar Community Fund.

If you'd like to contribute, watch this repo and check back for `good first issue` labels.

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
│   │   ├── ci.yml
│   │   ├── contract-test.yml
│   │   └── deploy-testnet.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── solver-integration.md
│   ├── CONTRIBUTING.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODE_OF_CONDUCT.md
│
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
- [ ] Intent Registry Soroban contract
- [ ] Solver Settlement Soroban contract
- [ ] TypeScript SDK
- [ ] Soroswap solver strategy
- [ ] Reference frontend
- [ ] Testnet deployment

### 🕸️ Phase 2 — Solver Network
- [ ] Blend, DeFindex, Path Payment strategies
- [ ] Solver registration & fee distribution
- [ ] Indexer + GraphQL API
- [ ] Solver monitoring dashboard

### 🚀 Phase 3 — Production
- [ ] Mainnet deployment
- [ ] SDK on npm
- [ ] Freighter wallet integration
- [ ] Multi-solver competition & slashing

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
