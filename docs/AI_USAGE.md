# AI_USAGE.md – SharedSplit

## AI Tools Used
- Antigravity IDE (Antigravity by Google DeepMind)

---

## Prompts Used

1. *"Create the full folder structure for a Node.js + Express + Prisma + React app for shared expense tracking, including all route/controller/service stubs"*
2. *"Write the balance calculation logic that respects membership join/leave dates"*
3. *"Write anomaly detectors for CSV import: duplicate, negative amount, currency, settlement-as-expense, bad date"*

---

## Cases Where AI Got It Wrong

### Case 1: Database Seed Unique Constraint Error on Group ID
- **AI Generation**: Seeded groups with hardcoded IDs (e.g. `id: 1`) but did not reset or sync the PostgreSQL autoincrement sequence generator.
- **Problem**: Subsequent group creations in `group.controller.js` failed with `Unique constraint failed on the fields: ('id')` because PostgreSQL's autoincrement counter started from 1 and conflicted.
- **Fix**: Appended sequence reset query executions to `prisma/seed.ts` after database insertions: `await prisma.$executeRawUnsafe("SELECT setval('groups_id_seq', COALESCE((SELECT MAX(id) FROM groups), 1));");`.

### Case 2: Sign Inversion in Net Balance Settlement Calculations
- **AI Generation**: Set the net balance formula as: `const netBalance = totalPaid - totalOwed - totalSent + totalReceived;`.
- **Problem**: Subtracted payments sent and added payments received, which is the mathematically inverted ledger representation (meaning settling debts doubled them instead).
- **Fix**: Corrected the formula signs to: `const netBalance = totalPaid - totalOwed + totalSent - totalReceived;`.

### Case 3: Ledger Pre-selection Hoisting Error on Mount
- **AI Generation**: In `BalancePage.jsx`, the asynchronous `viewDetail` function was called inside `fetchBalances` on mount, but `viewDetail` was declared with `const` below the `fetchBalances` declaration.
- **Problem**: Variables declared with `const` are not hoisted, resulting in a runtime `TypeError: viewDetail is not a function` error.
- **Fix**: Moved the `viewDetail` declaration above the `fetchBalances` method, adding check logic to prevent rendering recursion loops.
