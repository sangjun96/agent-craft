# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```

## Database (D1 + Drizzle)

The schema lives in `apps/web/worker/db/schema.ts`; migrations are generated into `apps/web/drizzle/` and must be committed.

```bash
vp run web#db:generate        # schema change -> new migration (drizzle-kit generate)
vp run web#db:migrate:local   # apply to the local D1 the dev server uses (.cloudflare/state)
vp run web#db:migrate:remote  # apply to the D1 database in the logged-in Cloudflare account
```

The migrate scripts run `cf d1 migrations apply` with the database ID from `apps/web/cloudflare.config.ts`.
