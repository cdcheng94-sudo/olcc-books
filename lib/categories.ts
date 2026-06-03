/**
 * Transaction categories — write-once, never rename.
 * Renaming a value here would orphan every existing transaction tagged
 * with the old string. To add a new category, append a value; to retire
 * one, hide it from the picker but leave it in this array so history
 * still resolves cleanly.
 *
 * Kept in sync with v1's Transactions.gs CATEGORIES constant.
 */
export const CATEGORIES = {
  income: [
    "Sales Income",
    "Service Income",
    "Other Income",
  ],
  expense: [
    "Salary",
    "Rent",
    "Accounting Fee",
    "Tax",
    "Utilities",
    "Office Supplies",
    "Software Subscription",
    "Other Expense",
  ],
} as const;

export type IncomeCategory = (typeof CATEGORIES.income)[number];
export type ExpenseCategory = (typeof CATEGORIES.expense)[number];
export type Category = IncomeCategory | ExpenseCategory;

// ---------- transaction types (Capital / Operating dual-pool) ----------
//
// 6 types split across two fund pools:
//   Operating Pool  ← income, expense, interest_paid   (also drive P&L)
//   Capital Pool    ← capital_injection, capital_expense, loan_repayment
//
// ⚠️ interest_paid pays a shareholder but is an OPERATING cost (tax-deductible)
//    so it hits the Operating Pool + P&L, NOT the Capital Pool.

export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "capital_injection",
  "capital_expense",
  "loan_repayment",
  "interest_paid",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Types whose movements live in / affect the Operating Pool + P&L. */
export const OPERATING_TYPES = ["income", "expense", "interest_paid"] as const;
/** Types whose movements live in / affect the Capital Pool (off P&L). */
export const CAPITAL_TYPES = ["capital_injection", "capital_expense", "loan_repayment"] as const;
/** Types that MUST carry a shareholder_id (DB + app both enforce). */
export const SHAREHOLDER_TYPES = ["capital_injection", "loan_repayment", "interest_paid"] as const;

export function isOperatingType(t: TransactionType): boolean {
  return (OPERATING_TYPES as readonly string[]).includes(t);
}
export function requiresShareholder(t: TransactionType): boolean {
  return (SHAREHOLDER_TYPES as readonly string[]).includes(t);
}

export function categoriesFor(type: TransactionType): readonly string[] {
  if (type === "income")  return CATEGORIES.income;
  if (type === "expense") return CATEGORIES.expense;
  return [];
}

// ---------- loan types (capital_injection only) ----------
export const LOAN_TYPES = ["director_loan", "paid_up_capital", "other"] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

// ---------- capital expense categories (capital_expense only) ----------
// Stored as a stable key in transactions.category; displayed via i18n
// (t.capitalCat[key]). Distinct from the income/expense categories above.
export const CAPITAL_CATEGORIES = [
  "renovation",
  "equipment",
  "registration",
  "logo_design",
  "software_license",
  "other",
] as const;
export type CapitalCategory = (typeof CAPITAL_CATEGORIES)[number];

/**
 * Claim-specific categories (per spec §3.5 — intentionally distinct from
 * Transaction categories). When a claim is marked paid, the cascaded
 * Transaction is tagged "Other Expense" with the claim category in note.
 */
export const CLAIM_CATEGORIES = [
  "Supplies",
  "Transport",
  "Meals",
  "Other",
] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const RECURRING_FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "Online Payment",
  "Other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
