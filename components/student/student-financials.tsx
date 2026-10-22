"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { formatGBP } from "@/lib/utils";
import { RecordPaymentModal } from "@/components/staff/record-payment-modal";

interface StudentFinancialsProps {
  studentId: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  referenceNumber: string;
  paymentMethod: string;
  notes?: string;
}

interface FinancialData {
  student: {
    id: string;
    studentId: string;
    fullName: string;
    email: string;
    programme: { code: string; name: string };
    assignedFee: number;
    feeDueDate: string;
  };
  summary: {
    assignedFee: number;
    totalPaid: number;
    outstandingBalance: number;
    isFullyPaid: boolean;
    isOverdue: boolean;
  };
  payments: PaymentRecord[];
}

export function StudentFinancials({ studentId }: StudentFinancialsProps) {
  const [data, setData] = React.useState<FinancialData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isPayOpen, setIsPayOpen] = React.useState(false);

  const loadFinancials = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/payments?studentId=${studentId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load student financials:", err);
    }
  }, [studentId]);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchFinancials() {
      try {
        const res = await fetch(`/api/payments?studentId=${studentId}`);
        const json = await res.json();
        if (isMounted && json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load student financials:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFinancials();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  if (loading || !data) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
        Loading tuition account balance...
      </div>
    );
  }

  const { summary, student, payments } = data;

  return (
    <div className="space-y-6">
      {/* Overdue Warning Callout for Student */}
      {summary.isOverdue && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-rose-900">Tuition Fee Settlement Overdue</h4>
            <p className="text-rose-700 mt-0.5">
              Your institutional balance of{" "}
              <strong>{formatGBP(summary.outstandingBalance)}</strong> was due on{" "}
              <strong>{student.feeDueDate}</strong>. Please arrange settlement immediately to prevent registration sanctions.
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Assigned Fee */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Annual Tuition
          </p>
          <p className="text-2xl font-bold text-slate-900">{formatGBP(summary.assignedFee)}</p>
          <p className="text-[11px] text-slate-400">
            Enrolment fee for {student.programme.code} ({student.programme.name})
          </p>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Amount Settled
          </p>
          <p className="text-2xl font-bold text-emerald-600">{formatGBP(summary.totalPaid)}</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{payments.length} transaction receipt{payments.length === 1 ? "" : "s"} on file</span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div
          className={`p-5 rounded-xl border shadow-xs space-y-2 ${
            summary.isOverdue
              ? "bg-rose-50/50 border-rose-300"
              : summary.isFullyPaid
              ? "bg-emerald-50/40 border-emerald-200"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding Balance
            </p>
            {summary.isOverdue && <Badge variant="rose">OVERDUE</Badge>}
            {summary.isFullyPaid && <Badge variant="emerald">FULLY PAID</Badge>}
          </div>

          <p
            className={`text-2xl font-bold ${
              summary.isOverdue
                ? "text-rose-700"
                : summary.isFullyPaid
                ? "text-emerald-700"
                : "text-slate-900"
            }`}
          >
            {formatGBP(summary.outstandingBalance)}
          </p>

          {summary.outstandingBalance > 0 && (
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs h-8"
              onClick={() => setIsPayOpen(true)}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              Pay Tuition Online
            </Button>
          )}
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-slate-500" />
            Official Payment Ledger & Audit Receipts
          </h4>
          <span className="text-[11px] text-slate-400">Due Date: {student.feeDueDate}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Transaction Reference</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Settled Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No payments have been recorded for this student account.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {p.referenceNumber}
                      {p.notes && <p className="text-[10px] text-slate-400 font-sans font-normal">{p.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.paymentDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {p.paymentMethod.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      +{formatGBP(p.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {isPayOpen && (
        <RecordPaymentModal
          isOpen={isPayOpen}
          onClose={() => setIsPayOpen(false)}
          students={[
            {
              id: student.id,
              studentId: student.studentId,
              fullName: student.fullName,
              assignedFee: summary.assignedFee,
              totalPaid: summary.totalPaid,
              outstandingBalance: summary.outstandingBalance,
              isOverdue: summary.isOverdue,
            },
          ]}
          preselectedStudentId={student.id}
          onSuccess={loadFinancials}
        />
      )}
    </div>
  );
}
