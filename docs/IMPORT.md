# CSV Import Specifications & Workflow

This document details the SharedSplit CSV import engine, explaining file specifications, name normalization logic, timing windows, anomaly handling, API endpoints, and user-facing workflows.

---

## 1. CSV File Schema

The CSV importer expects a flat file with the following column headers:

| Header | Expected Format | Description |
|---|---|---|
| `date` | `DD-MM-YYYY` or `YYYY-MM-DD` | The date of the transaction |
| `description` | String | Details of the transaction (e.g. "Rent", "Dinner") |
| `amount` | Numeric (e.g. `1250.50`) | The value of the transaction |
| `currency` | `INR` or `USD` | The currency of the transaction. USD is automatically converted to INR |
| `paid_by` | String | Name of the person who paid the amount |
| `split_with` | Semicolon-separated string (e.g., `Aisha; Rohan`) | (Optional) Explicit members sharing this cost. If blank, splits among all active group members |

### Example CSV Content
```csv
date,description,amount,currency,paid_by,split_with
15-03-2026,Rent,15000,INR,Aisha,Aisha;Rohan;Priya
16-03-2026,Lunch,45,USD,Rohan,Rohan;Priya;Dev's Friend Kabir
17-03-2026,Priya Paid back Aisha,2000,INR,Priya,Aisha
```

---

## 2. Core Business Rules & Normalizations

### A. Name Normalization
To handle messy real-world imports, the engine trims whitespace and resolves known aliases before performing user matching:
* `priya s` and `priya` $\rightarrow$ `Priya`
* `rohan` $\rightarrow$ `Rohan`
* `aisha` $\rightarrow$ `Aisha`
* `meera` $\rightarrow$ `Meera`
* `dev` $\rightarrow$ `Dev`
* `sam` $\rightarrow$ `Sam`

### B. Automatically Managed Membership Windows
If a transaction involves a user who is not yet a member of the group:
* The system registers the user if they do not exist.
* The system creates/updates their group membership window. The `joinedAt` date defaults to **1 day before their earliest imported transaction** to ensure historical validity.
* **Meera's Special Rule**: Meera's membership is capped with `leftAt = '2026-03-31'`. Any transaction involving her after this date triggers an anomaly.

### C. Dev's Friend Kabir (Guest Rule)
Kabir is a guest user and is **excluded from database registration**. 
* Any split involving him redistributes his share equally among the other active participants of that transaction.
* If a transaction is split between `Rohan`, `Priya`, and `Dev's Friend Kabir`, Kabir's portion is discarded/redistributed, and the final split is divided $50/50$ between Rohan and Priya.

### D. Rounding Allocations
All division splits are rounded down to the nearest paisa (`0.01 INR`). The accumulated remainder is allocated directly to the payer of the expense, ensuring total auditability and zero lost pennies.

---

## 3. The 14 Anomaly Detectors

Every row in the CSV is passed through the following detectors:

1. **`missing_fields`**: Flags rows with empty date, payer, or amount. (Severity: **ERROR**)
2. **`bad_date_format`**: Flags date values that cannot be parsed. (Severity: **ERROR**)
3. **`invalid_amount`**: Flags non-numeric amount strings. (Severity: **ERROR**)
4. **`zero_amount`**: Flags transactions with an amount of zero. (Severity: **ERROR**)
5. **`invalid_currency_code`**: Flags currencies other than `INR` or `USD`. (Severity: **ERROR**)
6. **`empty_description`**: Warns if a transaction description is blank. (Severity: **WARNING**)
7. **`future_date`**: Warns if the transaction date is in the future. (Severity: **WARNING**)
8. **`negative_amount`**: Warns if the amount is negative. (Severity: **WARNING**)
9. **`settlement_as_expense`**: Flags descriptions containing settlement keywords (e.g., *repay*, *settle*, *returned*, *paid back*) as settlements disguised as expenses. (Severity: **WARNING**)
10. **`unknown_member`**: Flags if the payer or a participant is not currently a member of the group. (Severity: **WARNING**)
11. **`expense_before_member_joined`**: Flags if the transaction date falls before a participant joined the group. (Severity: **WARNING**)
12. **`expense_after_member_left`**: Flags if the transaction date falls after a participant left the group. (Severity: **WARNING**)
13. **`duplicate`**: Flags if an identical transaction (same date, amount, description) exists in this batch or database (Meera's Rule: never auto-deleted). (Severity: **WARNING**)
14. **`duplicate_settlement`**: Flags if a matching settlement log already exists in the database. (Severity: **WARNING**)

---

## 4. API Endpoints

### 1. Upload CSV
* **Endpoint**: `POST /api/groups/:groupId/import`
* **Payload**: `multipart/form-data` with `file` field.
* **Response**: Returns summary of committed clean rows and a `batchId` for the review queue.

### 2. Fetch Anomaly Queue
* **Endpoint**: `GET /api/imports/:batchId/anomalies`
* **Response**: Returns a list of unresolved anomalies belonging to the upload batch.

### 3. Resolve Anomaly
* **Endpoint**: `PATCH /api/imports/anomalies/:anomalyId/resolve`
* **Body**:
  ```json
  {
    "action": "APPROVED" | "REJECTED",
    "groupId": 1
  }
  ```
* **Reclassification Rule**: If approved and flagged as `settlement_as_expense`, the row is automatically written to the `settlements` ledger instead of `expenses`.

### 4. Fetch Import Batch Report
* **Endpoint**: `GET /api/imports/:batchId/report`
* **Response**: Final summary report with lists of committed items, rejected items, normalizations, and stats.

---

## 5. UI Walkthrough & User Actions

The import process is fully interactive and guides the user through three phases:

1. **Upload Phase**: The user selects a CSV file on the Group Dashboard and uploads it. Clean rows are immediately committed to the database, while rows flagged with anomalies are queued.
2. **Review Queue Phase**: The user is navigated to the review screen (`/groups/:groupId/import/:batchId/review`). The user must resolve each anomaly:
   * **Approve**: Imports the transaction (reclassifying settlements or registering new members automatically if applicable).
   * **Reject**: Skips/discards the row.
3. **Report Phase**: Once the queue is empty, the user views a summary report displaying normalizations applied, committed expenses, reclassified settlements, and rejected entries. The user can download the final audit trail as a JSON file.
