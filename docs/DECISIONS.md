# DECISIONS.md – SharedSplit Architecture Decisions

## D1: Currency Conversion
**Decision**: Convert all non-INR currencies to INR at the exchange rate on the date of the transaction. Store both the `amount` (original), `currency` (original), `exchangeRate`, and `amountInInr` (converted) in the database.
**Why**: Ensures auditability and data integrity. If rates are ever updated, we can reconstruct the conversions without losing historical data.
**Rate API & Fallback**: Fetches rate from exchangerate.host. If the API is unreachable, the system falls back to a realistic mock rate (e.g. 1 USD = 83.3 INR) rather than defaulting to 1.0, preserving balance correctness.

---

## D2: Rounding Policy
**Decision**: Round down each split share to the nearest paisa (2 decimal places). The fractional remainder is allocated to the first user in the split list (payer).
**Why**: Deterministic, simple, and avoids division leaks.

---

## D3: Duplicates
**Decision**: Flag exact matching transactions (same date + description + amount) within the same batch or database. Route them to the anomaly review queue as `PENDING` items.
**Why**: Satisfies Meera's business rule requiring explicit manual approval before deleting or removing duplicate entries.

---

## D4: Reclassifying Settlements
**Decision**: Identify settlements disguised as expenses (e.g. description includes "repay", "settle", "transfer"). On user approval, write them to the `settlements` table instead of `expenses` to prevent ledger calculations distortion.
**Why**: Settlements alter outstanding balances directly and must not be treated as expenses (which are split).

---

## D5: Membership Timings
**Decision**: User balances are only affected by expenses whose date falls within `[joinedAt, leftAt)`.
**Why**: Prevents users from being charged for bills that occurred before they joined the group or after they left.
**Implementation**: The `BalanceService` filters expense and split queries using the joined/left timestamps.

---

## D6: Guest Users (Kabir)
**Decision**: Exclude Kabir (guest user) from database registration or group membership. Instead, exclude Kabir from split calculations and redistribute his share equally among the actual active members of the group.
**Why**: Keeps the member directory, ledger balances, and settlement graphs clean since Kabir is a one-time guest.
