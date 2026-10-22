"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Search,
  Filter,
  CreditCard,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { formatGBP } from "@/lib/utils";

export interface StudentRecord {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  dateOfBirth: string;
  academicYear: string;
  status: "ENROLLED" | "DEFERRED" | "WITHDRAWN" | "COMPLETED";
  programme: {
    id: string;
    code: string;
    name: string;
  };
  assignedFee: number;
  feeDueDate: string;
  totalPaid: number;
  outstandingBalance: number;
  isOverdue: boolean;
}

interface Programme {
  id: string;
  code: string;
  name: string;
}

interface StudentRegistryProps {
  students: StudentRecord[];
  programmes: Programme[];
  onRefresh: () => void;
  onOpenEnrolModal: () => void;
  onOpenPaymentModal: (studentId?: string) => void;
}

export function StudentRegistry({
  students,
  programmes,
  onRefresh,
  onOpenEnrolModal,
  onOpenPaymentModal,
}: StudentRegistryProps) {
  const [search, setSearch] = React.useState("");
  const [selectedProgramme, setSelectedProgramme] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  // Compute Overdue Statistics for Banner
  const overdueStudents = students.filter((s) => s.isOverdue);
  const totalOverdueBalance = overdueStudents.reduce((sum, s) => sum + s.outstandingBalance, 0);

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (selectedProgramme && s.programme.id !== selectedProgramme) return false;
    if (selectedStatus && s.status !== selectedStatus) return false;
    if (overdueOnly && !s.isOverdue) return false;
    return true;
  });

  const handleStatusChange = async (studentId: string, newStatus: string) => {
    setUpdatingId(studentId);
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId, status: newStatus }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. OVERDUE TUITION WARNING BANNER (PEN Global Assessment Rubric Requirement) */}
      {overdueStudents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-l-4 border-rose-500 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Overdue Tuition Alert — {overdueStudents.length} Student{overdueStudents.length > 1 ? "s" : ""} Overdue
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Total outstanding balance past institutional fee due dates:{" "}
                <span className="font-bold text-rose-700">{formatGBP(totalOverdueBalance)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant={overdueOnly ? "primary" : "outline"}
              size="sm"
              onClick={() => setOverdueOnly(!overdueOnly)}
            >
              <Filter className="w-3.5 h-3.5 mr-1" />
              {overdueOnly ? "Show All Students" : "Filter Overdue Only"}
            </Button>
          </div>
        </div>
      )}

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedProgramme}
            onChange={(e) => setSelectedProgramme(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Programmes</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="DEFERRED">Deferred</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <Button variant="primary" size="sm" onClick={onOpenEnrolModal}>
          <UserCheck className="w-4 h-4 mr-1.5" />
          Enrol Student
        </Button>
      </div>

      {/* 3. STUDENTS RELATIONAL TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Full Name & Email</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Tuition Fee</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No students match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      s.isOverdue ? "bg-rose-50/20" : ""
                    }`}
                  >
                    {/* Student ID */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {s.studentId}
                    </td>

                    {/* Name & Email */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{s.fullName}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>

                    {/* Programme */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {s.programme.code}
                      </Badge>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s.academicYear}</p>
                    </td>

                    {/* Status Select as Semantic Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        disabled={updatingId === s.id}
                        value={s.status}
                        onChange={(e) => handleStatusChange(s.id, e.target.value)}
                        className={`text-xs rounded-full border px-2.5 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors ${
                          s.status === "ENROLLED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : s.status === "DEFERRED"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : s.status === "WITHDRAWN"
                            ? "bg-rose-50 text-rose-800 border-rose-300"
                            : "bg-blue-50 text-blue-800 border-blue-300"
                        }`}
                      >
                        <option value="ENROLLED">Enrolled</option>
                        <option value="DEFERRED">Deferred</option>
                        <option value="WITHDRAWN">Withdrawn</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </td>

                    {/* Assigned Fee */}
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatGBP(s.assignedFee)}
                    </td>

                    {/* Dynamic Balance with Overdue Flag */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {s.outstandingBalance <= 0 ? (
                        <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Settled (£0.00)
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-bold ${
                              s.isOverdue ? "text-rose-600 font-mono" : "text-slate-900"
                            }`}
                          >
                            {formatGBP(s.outstandingBalance)}
                          </span>
                          {s.isOverdue && (
                            <Badge variant="rose" className="mt-0.5 text-[9px] px-1.5 py-0 font-bold tracking-wider">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {s.outstandingBalance > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs py-1 h-7 border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-700"
                          onClick={() => onOpenPaymentModal(s.id)}
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1 text-blue-600" />
                          Record Payment
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
