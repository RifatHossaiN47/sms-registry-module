"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertCircle } from "lucide-react";
import { formatGBP } from "@/lib/utils";

interface StudentSummary {
  id: string;
  studentId: string;
  fullName: string;
  assignedFee: number;
  totalPaid: number;
  outstandingBalance: number;
  isOverdue?: boolean;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentSummary[];
  preselectedStudentId?: string;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  students,
  preselectedStudentId,
  onSuccess,
}: RecordPaymentModalProps) {
  const [studentId, setStudentId] = React.useState(preselectedStudentId || "");
  const [amount, setAmount] = React.useState<string>("");
  const [paymentMethod, setPaymentMethod] = React.useState<"BANK_TRANSFER" | "CARD" | "CASH">("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const effectiveStudentId = studentId || preselectedStudentId || students[0]?.id || "";
  const activeStudent = students.find((s) => s.id === effectiveStudentId);

  // Generate unique transaction reference helper
  const handleGenerateRef = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setReferenceNumber(`TX-${paymentMethod.slice(0, 4)}-${new Date().getFullYear()}-${rand}`);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const maxAllowed = activeStudent ? activeStudent.outstandingBalance : 0;
  const isOverpaying = parsedAmount > maxAllowed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isOverpaying) {
      setError(`Payment amount (£${parsedAmount.toFixed(2)}) exceeds outstanding balance (£${maxAllowed.toFixed(2)}).`);
      return;
    }

    if (parsedAmount <= 0) {
      setError("Payment amount must be greater than £0.00.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: effectiveStudentId,
          amount: parsedAmount,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record payment");
      }

      setAmount("");
      setReferenceNumber("");
      setNotes("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Tuition Payment"
      description="Record a received payment transaction to credit the student's tuition fee account."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Target Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.studentId}) — Balance: {formatGBP(s.outstandingBalance)}
              </option>
            ))}
          </select>
        </div>

        {activeStudent && (
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tuition Fee</p>
              <p className="font-semibold text-slate-900">{formatGBP(activeStudent.assignedFee)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Paid</p>
              <p className="font-semibold text-emerald-600">{formatGBP(activeStudent.totalPaid)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Balance Due</p>
              <p className={`font-bold ${activeStudent.isOverdue ? "text-rose-600 font-mono" : "text-slate-900"}`}>
                {formatGBP(activeStudent.outstandingBalance)}
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Payment Amount (£)</label>
            {activeStudent && (
              <button
                type="button"
                onClick={() => setAmount(activeStudent.outstandingBalance.toString())}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                Set Full Balance ({formatGBP(activeStudent.outstandingBalance)})
              </button>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full text-sm font-semibold rounded-lg border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 ${
              isOverpaying
                ? "border-rose-400 bg-rose-50/50 focus:ring-rose-500"
                : "border-slate-300 focus:ring-blue-500"
            }`}
          />
          {isOverpaying && (
            <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Overpayment strictly blocked: Maximum payable is £{maxAllowed.toFixed(2)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "BANK_TRANSFER" | "CARD" | "CASH")}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BANK_TRANSFER">Bank Transfer (BACS/Faster)</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="CASH">Cash Deposit (Desk)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">Reference No.</label>
              <button
                type="button"
                onClick={handleGenerateRef}
                className="text-[10px] text-blue-600 hover:underline"
              >
                Auto-Fill
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. TX-BANK-2025-9941"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Auditing Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Term 1 installment verified via Barclays statement"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || isOverpaying || parsedAmount <= 0}
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            {loading ? "Processing ACID Lock..." : "Post Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
