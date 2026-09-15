<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Feedback loops — run them, don't guess

After any code change, run the checks and fix what they report before calling the work done:

- `npm run check` — everything below in one go (use this before finishing)
- `npm run typecheck` — TypeScript errors
- `npm run lint` — ESLint (Next.js rules)
- `npm test` — Vitest unit tests (`__tests__/`); `npm run test:watch` while iterating
- `npm run format` — Prettier; formatting is never a matter of opinion here

Rules:

- Add or update tests in `__tests__/` for any logic you change (see `__tests__/login/` for the style: Supabase and `next/navigation` are mocked, never the real project).
- A Husky pre-commit hook runs lint-staged (ESLint + Prettier on staged files), typecheck and tests. If it fails, fix the cause — never bypass it with `--no-verify`.
- Tests must never talk to the real Supabase project, send emails, or create accounts.
