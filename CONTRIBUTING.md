# Contributing

## Branching

- Keep `main` deployable.
- Use short-lived feature branches.
- Prefer small pull requests with one obvious purpose.

## Code Style

- TypeScript first.
- ASCII by default unless the file already requires otherwise.
- Prefer explicit types and shared domain models for payment-critical paths.
- Keep policy logic deterministic and testable.

## PR Checklist

- Scope is tight and directly tied to the active PRD.
- Security-sensitive changes include notes on tenancy, auth, and idempotency.
- New behavior includes tests or a written reason they are deferred.
- Docs are updated when contracts or workflows change.

