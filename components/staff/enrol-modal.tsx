"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles, AlertCircle } from "lucide-react";

interface Programme {
  id: string;
  code: string;
  name: string;
  defaultFee?: number | string;
}

interface EnrolModalProps {
  isOpen: boolean;
  onClose: () => void;
  programmes: Programme[];
  onSuccess: () => void;
}

export function EnrolModal({ isOpen, onClose, programmes, onSuccess }: EnrolModalProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("2003-01-15");
  const [academicYear, setAcademicYear] = React.useState("2024/25");
  const [programmeId, setProgrammeId] = React.useState(programmes[0]?.id || "");
  const [feeDueDate, setFeeDueDate] = React.useState("2026-11-30");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeProgrammeId = programmeId || programmes[0]?.id || "";
  const selectedProgramme = programmes.find((p) => p.id === activeProgrammeId);

  // Compute live sequential ID preview
  const yearPrefix = academicYear.slice(0, 4) || "2025";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          dateOfBirth,
          academicYear,
          programmeId: activeProgrammeId,
          feeDueDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to enrol student");
      }

      // Reset and close
      setFullName("");
      setEmail("");
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
      title="Enrol New Student"
      description="Register an undergraduate student to an academic degree programme and generate their institutional fee schedule."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live ID Preview Callout */}
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-blue-900">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Institutional Student ID Format:</span>
          </div>
          <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded border border-blue-200">
            SMS-{yearPrefix}-XXXX
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Eleanor Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.vance@student.pen.ac.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date of Birth <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              pattern="^\d{4}/\d{2}$"
              placeholder="YYYY/YY (e.g. 2024/25)"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Academic intake format: YYYY/YY (e.g. 2024/25)</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Degree Programme <span className="text-rose-500">*</span>
          </label>
          <select
            value={programmeId}
            onChange={(e) => setProgrammeId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          {selectedProgramme && (
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Annual Programme Tuition: £{Number(selectedProgramme.defaultFee || 5000).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tuition Fee Due Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            value={feeDueDate}
            onChange={(e) => setFeeDueDate(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            {loading ? "Enrolling..." : "Complete Enrolment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
