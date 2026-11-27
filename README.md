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

### Savings

The authenticated savings API provides `savings`, `savingsById(_id: ID!)`,
`addSavings(amount: Float!, savingCategoryId: ID!, savingDate: String)`,
`updateSavings(_id: ID!, amount: Float, savingCategoryId: ID, savingDate: String)`,
and `deleteSavings(_id: ID!)`. All operations are scoped to the current user.
Savings responses include `userId`. Creating savings assigns the user ID from
the authorization token; `savings` lists only records with that user ID.
Clients do not need to pass a user ID.
Amounts must be at least 1, categories must belong to the current user, and saving dates
accept ISO dates (`2026-01-01`) or ISO timestamps with a timezone
(`2026-01-01T12:30:00Z`). Dates and timestamps in responses are ISO strings.
For `addSavings`, a null or omitted saving date defaults to the current date
and time for that request. Invalid date strings are still rejected.
Updates require at least one field; omitted fields are preserved and explicit
null values are rejected. Results return `success`, `message`,
`errors { field message }`, and `response`.

Saving categories have `name`, `userId`, and timestamps. Use `savingCategories`,
`addSavingCategory(name: String!)`, `updateSavingCategory(_id: ID!, name: String!)`,
and `deleteSavingCategory(_id: ID!)` to manage the authenticated user's categories.
Names must be nonblank. Deletion is rejected while savings reference the category;
reassign or delete those savings first.

Create a category and use its returned `_id` as `savingCategoryId`:

```graphql
mutation {
  addSavingCategory(name: "LIC") {
    success
    errors { field message }
    response { _id userId name }
  }
}
```

```graphql
mutation AddSavings($categoryId: ID!) {
  addSavings(amount: 20000, savingCategoryId: $categoryId, savingDate: null) {
    success
    errors { field message }
    response { _id userId savingCategoryId amount savingDate }
  }
}
```

**Breaking change:** `savingType` is replaced by the required `savingCategoryId`.
Before using this API with existing data, manually create categories per user
and assign a valid category ObjectId to each savings record's `savingCategoryId`.
Update client mutations and response selections accordingly. Restart the
development server after the model change so Mongoose registers the new schema.

Run savings regression tests with:

```bash
npm test -- --run __tests__/graphql/savings.resolvers.test.ts __tests__/graphql/savingCategory.resolvers.test.ts
```

### Expenses and categories

Expenses reference the existing `Category` model through `category`, stored as
a MongoDB ObjectId and returned as a GraphQL ID string. Creating expenses
requires `amount` (at least 1) and `category` (an existing category owned by the
authenticated user). Validation happens before saving. Null or omitted create
dates default to the current time; supplied dates accept ISO dates or timestamps
with a timezone. Merchant and description are optional text, not IDs.

All expense/category reads, updates, and deletes are restricted to the current
user. Category names must be nonblank. Creating a duplicate name for the same
user is rejected. Categories cannot be deleted while expenses reference them.
Expense and category mutations return the record in `response`, including
`_id` and `userId`. Dates in expense responses are ISO strings.

```graphql
mutation {
  addCategory(name: "Movies") {
    success
    errors { field message }
    response { _id userId name }
  }
}
```

```graphql
mutation AddExpense($categoryId: ID!) {
  addExpense(input: { amount: 25, category: $categoryId, merchant: "Cinema" }) {
    success
    errors { field message }
    response { _id userId category amount date merchant }
  }
}
```

`addExpense` no longer requires a client-generated `_id`. `ExpenseInput`
requires `amount` and `category`; partial updates use `UpdateExpenseInput`.
Updates preserve omitted fields, require at least one field, and reject null
amount/category/date. Optional merchant/description can be cleared with null.
The existing `expenses(startDate, endDate)` filter applies when both dates are
provided, includes the end day, and excludes the following midnight.

**Existing data:** restart the development server after model changes. Convert
existing string-valued expense categories to ObjectIds referencing categories
owned by the same user before using category deletion protection. Invalid or
unowned references need reassignment. No database migration is run automatically.
Responses normalize both valid string category IDs and ObjectIds. If the old
Mongoose model remains cached during hot reload, restart the server to ensure
new expense categories are stored as ObjectIds.
Update client mutation variable types for `UpdateExpenseInput`.

```bash
npm test -- --run __tests__/graphql/expense.resolvers.test.ts __tests__/graphql/category.resolvers.test.ts __tests__/graphql/by-id.queries.test.ts __tests__/models/models.test.ts
```

### Get a record by ID

The GraphQL API provides `incomeById(_id: ID!)`, `expenseById(_id: ID!)`,
and `categoryById(_id: ID!)`. Each returns `success`, `message`,
`errors { field message }`, and a nullable single-record `response`.
These queries require the current authorization token and only read records
owned by that user. Missing records and another user's records both return
a not-found response. Invalid IDs are rejected before database access.
Dates in these responses are ISO strings.

```graphql
query GetRecords($incomeId: ID!, $expenseId: ID!, $categoryId: ID!) {
  incomeById(_id: $incomeId) {
    success
    errors { field message }
    response { _id amount source date }
  }
  expenseById(_id: $expenseId) {
    success
    errors { field message }
    response { _id amount category merchant date }
  }
  categoryById(_id: $categoryId) {
    success
    errors { field message }
    response { _id name userId }
  }
}
```

Run the by-ID query regression tests with:

```bash
npm test -- --run __tests__/graphql/by-id.queries.test.ts
```

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
