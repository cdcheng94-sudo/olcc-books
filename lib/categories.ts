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
    "Capital Injection",
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
export type TransactionType = "income" | "expense";

export function categoriesFor(type: TransactionType): readonly string[] {
  return type === "income" ? CATEGORIES.income : CATEGORIES.expense;
}

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
