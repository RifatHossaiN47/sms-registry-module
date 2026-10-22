import { Prisma } from "@prisma/client";

/**
 * Pure domain logic for University Registry Fees & Financial Accounting.
 * Adheres to Zero-Stored Computed State: balances and overdue flags are computed at runtime.
 */

export interface FeeCalculationResult {
  assignedFee: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  outstandingBalance: Prisma.Decimal;
  isFullyPaid: boolean;
}

/**
 * Computes total payments and outstanding balance using fixed-point Decimal arithmetic.
 */
export function calculateBalance(
  assignedFee: Prisma.Decimal | number | string,
  payments: Array<{ amount: Prisma.Decimal | number | string }>
): FeeCalculationResult {
  const feeDecimal = new Prisma.Decimal(assignedFee);
  
  const totalPaidDecimal = payments.reduce<Prisma.Decimal>((sum, p) => {
    return sum.plus(new Prisma.Decimal(p.amount));
  }, new Prisma.Decimal(0));

  const outstandingBalance = feeDecimal.minus(totalPaidDecimal);

  return {
    assignedFee: feeDecimal,
    totalPaid: totalPaidDecimal,
    outstandingBalance,
    isFullyPaid: outstandingBalance.lessThanOrEqualTo(0),
  };
}

/**
 * Pure function to determine if a student's tuition is overdue.
 * Invariant: isOverdue is TRUE only if outstandingBalance > 0 AND now > feeDueDate.
 * Injectable 'now' parameter ensures deterministic unit testability.
 */
export function isOverdue(
  outstandingBalance: Prisma.Decimal | number | string,
  feeDueDate: Date | string,
  now: Date = new Date()
): boolean {
  const balanceDecimal = new Prisma.Decimal(outstandingBalance);
  if (balanceDecimal.lessThanOrEqualTo(0)) {
    return false;
  }

  const dueDate = new Date(feeDueDate);
  return now.getTime() > dueDate.getTime();
}

/**
 * Validates whether a payment amount is valid and does not cause an overpayment.
 * Invariant: paymentAmount > 0 AND paymentAmount <= outstandingBalance.
 */
export function validatePayment(
  paymentAmount: Prisma.Decimal | number | string,
  outstandingBalance: Prisma.Decimal | number | string
): { valid: boolean; error?: string; code?: "ZERO_OR_NEGATIVE" | "EXCEEDS_BALANCE" } {
  const payment = new Prisma.Decimal(paymentAmount);
  const balance = new Prisma.Decimal(outstandingBalance);

  if (payment.lessThanOrEqualTo(0)) {
    return {
      valid: false,
      code: "ZERO_OR_NEGATIVE",
      error: "Payment amount must be greater than zero.",
    };
  }

  if (balance.lessThanOrEqualTo(0)) {
    return {
      valid: false,
      code: "EXCEEDS_BALANCE",
      error: "Student has already settled all assigned fees. Outstanding balance is £0.00.",
    };
  }

  if (payment.greaterThan(balance)) {
    return {
      valid: false,
      code: "EXCEEDS_BALANCE",
      error: `Payment amount (£${payment.toFixed(2)}) exceeds outstanding balance (£${balance.toFixed(2)}). Overpayments are not permitted.`,
    };
  }

  return { valid: true };
}

/**
 * Formats a Decimal, number, or string as a standard UK currency string (£X,XXX.XX).
 */
export function formatCurrency(amount: Prisma.Decimal | number | string): string {
  const dec = new Prisma.Decimal(amount);
  const num = dec.toNumber();
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(num);
}
