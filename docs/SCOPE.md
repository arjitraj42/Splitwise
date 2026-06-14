# SCOPE.md – SharedSplit (TypeScript / PostgreSQL)

## Schema Overview

The application utilizes a PostgreSQL database. Below is the mapping of all tables:

| Table | Purpose |
|---|---|
| `users` | User registration, password hashes, and session authentication |
| `groups` | Expense groups shared by flatmates, friends, or travelers |
| `group_memberships` | Timeline tracking of active members (joined_at / left_at dates) |
| `expenses` | Expense log showing description, original amount, currency, and converted base INR values |
| `expense_splits` | Per-person share distribution for each expense, saved in normalized INR |
| `settlements` | Repayment transactions recorded to settle debt balances |
| `import_batches` | Import batches logged for tracking uploaded CSV files |
| `import_anomalies` | Transactions flagged by detectors, retaining original data for user review |

---

## Supported Split Types

| Split Type | Input | Normalization / Business Rules |
|---|---|---|
| `EQUAL` | userIds[] | Transaction amount divided equally. Rounding remainder allocated to the first user (payer) |
| `EXACT` | { userId, amount }[] | Custom exact amounts per user. Splits sum must equal transaction amount |
| `PERCENTAGE` | { userId, percentage }[] | Custom percentage values per user. Percentages sum must equal 100%. Remainder goes to first user |
| `SHARES` | { userId, shares }[] | Shares ratios. Sum of shares divides the total, distributing to users accordingly |

---

## Anomaly Detectors

The CSV importer runs 14 detectors to validate transaction entries. Detected anomalies are routed to a manual review queue:

| Anomaly Detector | Trigger Condition | Severity | suggestedAction / Handling Policy |
|---|---|---|---|
| `missing_fields` | empty date, payer, or amount | ERROR | Reject row immediately |
| `empty_description` | blank description field | WARNING | Flag for review; defaults to "Imported Expense" |
| `bad_date_format` | date string cannot be parsed | ERROR | Reject row immediately |
| `future_date` | transaction date is in the future | WARNING | Flag for review; require manual confirmation |
| `invalid_amount` | amount is not a valid number | ERROR | Reject row immediately |
| `zero_amount` | amount is exactly zero | ERROR | Reject row immediately |
| `negative_amount` | amount is negative | WARNING | Flag for review; verify if refund or correction |
| `invalid_currency_code`| currency is not INR or USD | ERROR | Reject row immediately |
| `settlement_as_expense`| description contains settlement keywords | WARNING | Flag for review; reclassify row as a settlement payment |
| `unknown_member` | payer or participant not in group | WARNING | Flag for review; register/add user to group on approval |
| `expense_before_member_joined` | date is before member joined_at | WARNING | Flag for review; require timing validation |
| `expense_after_member_left` | date is after member left_at | WARNING | Flag for review; require timing validation |
| `duplicate` | identical date, amount, description | WARNING | Flag for review; require Meera's approval before adding |
| `duplicate_settlement` | identical settlement details | WARNING | Flag for review; require manual confirmation |
