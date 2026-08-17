# apps/web

Next.js operator console for Railguard (PreBroadcast UI).

Current surfaces:

- dashboard
- invoice inbox
- invoice detail with approval and payment actions
- invoice upload
- vendor list and vendor detail
- workspace settings
- audit trail and export flow

Key environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL` — optional; defaults to `/api` (same-origin proxy) in the browser
- `ENCORE_API_URL` — server-side proxy target (Vercel); defaults to staging Encore
- `NEXT_PUBLIC_ALLOW_DEV_AUTH`
- `NEXT_PUBLIC_DEFAULT_ORG_ID`
