# Contributing to FluxRoute

Thank you for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/fluxroute.git
cd fluxroute
cp .env.example .env
npm install
```

## Branch Naming

- `feat/your-feature` — new features
- `fix/bug-description` — bug fixes
- `solver/protocol-name` — new solver strategy integrations
- `docs/what-you-updated` — documentation updates

## Commit Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(sdk): add useIntent hook
fix(solver): handle expired intents gracefully
docs(readme): update quick start instructions
```

## Claiming an Issue

Before starting work, comment on the issue: **"I'd like to work on this"**.
A maintainer will assign it to you. Do not open a PR for an unassigned issue.

## Adding a Solver Strategy

1. Create `packages/solver/src/strategies/your-protocol.ts`
2. Implement the `SolverStrategy` interface
3. Register it in `packages/solver/src/solver.ts`
4. Add unit tests in `tests/unit/`
5. Open a PR referencing the relevant issue

## PR Checklist

- [ ] Branch is up to date with `main`
- [ ] All tests pass (`npm run test`)
- [ ] No TypeScript errors (`npm run lint`)
- [ ] PR description explains what and why
- [ ] Linked to a GitHub issue
