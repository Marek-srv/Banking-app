/**
 * Account invariant: an account must belong to the same branch as its customer.
 * Future account creation must validate this before persisting the account.
 */
export function assertAccountBranchMatchesCustomer(
  accountBranchId: bigint,
  customerBranchId: bigint
): void {
  if (accountBranchId !== customerBranchId) {
    throw new Error("ACCOUNT_BRANCH_MUST_MATCH_CUSTOMER_BRANCH");
  }
}

export function accountBranchForCustomer(customerBranchId: bigint): bigint {
  return customerBranchId;
}

export const MAX_SAVINGS_ACCOUNTS = 3;
export const MAX_CURRENT_ACCOUNTS = 2;
export const COUNTED_ACCOUNT_STATUSES = ["ACTIVE", "FROZEN", "DORMANT"] as const;

export type NormalAccountType = "SAVINGS" | "CURRENT";

export function accountLimitForType(accountType: NormalAccountType): number {
  return accountType === "SAVINGS"
    ? MAX_SAVINGS_ACCOUNTS
    : MAX_CURRENT_ACCOUNTS;
}

export function deriveIfscFromBranchCode(branchCode: string): string {
  const normalized = branchCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `PIBK${normalized}`.slice(0, 20);
}
