This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Backend Tests

Backend tests are centralized in [`__tests__/`](./__tests__/) and run in the Node
environment. They cover auth and income resolvers, GraphQL HTTP requests and
context, input validation, password and JWT helpers, database connections, and
Mongoose document validation. No running Next.js server or MongoDB instance is
required; database operations are mocked.

Income API schemas normalize IDs to strings. The income database model uses a
separate document type so `userId` remains a MongoDB ObjectId for references.

```bash
# Run the complete backend suite once
npm test -- --run __tests__

# Run only auth resolver tests
npm test -- --run __tests__/graphql/auth.resolvers.test.ts

# Generate backend-only coverage with the existing 80% thresholds
npm run test:coverage:backend
```

The backend coverage command includes all GraphQL modules, shared libraries,
models, validation schemas, and the GraphQL HTTP route. It writes the HTML report
to [`coverage/backend/index.html`](./coverage/backend/index.html) and JSON coverage
to [`coverage/backend/coverage-final.json`](./coverage/backend/coverage-final.json).
The existing `test:coverage` command still measures the entire application,
including frontend code.

Tests cover authenticated MongoDB income CRUD, date filtering, ID normalization,
missing/null date handling, authorization failures, and database/validation errors.
HTTP tests exercise income and auth mutations together to catch resolver-map
overwrites.

The tests preserve current behavior rather than changing production code.
Known backend limitations remain:

- Refresh token verification requires `tokenVersion`, but the refresh token
  signer does not include it.
- Partial income updates currently apply the schema's default date when no
  date is supplied.
- Income date filtering currently includes midnight at the start of the day
  after `endDate`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
