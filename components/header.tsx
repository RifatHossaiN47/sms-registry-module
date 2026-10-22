"use client";

import * as React from "react";
import { GraduationCap, ShieldCheck, UserCheck, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface StudentOption {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  status: string;
  isOverdue?: boolean;
}

interface HeaderProps {
  currentPersona: "staff" | "student";
  onPersonaChange: (persona: "staff" | "student") => void;
  students: StudentOption[];
  selectedStudentId: string;
  onStudentChange: (studentId: string) => void;
}

export function Header({
  currentPersona,
  onPersonaChange,
  students,
  selectedStudentId,
  onStudentChange,
}: HeaderProps) {
  const activeStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand & Module Identification */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-sm ring-1 ring-blue-900/10">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  PEN Global
                </span>
                <Badge variant="primary" className="font-mono text-[10px] tracking-wider uppercase">
                  Registry Module
                </Badge>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Higher Education Student Management System & Moderation Engine
              </p>
            </div>
          </div>

          {/* Interactive Persona Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="bg-slate-100/90 p-1 rounded-xl flex items-center border border-slate-200/60 shadow-inner">
              <button
                onClick={() => onPersonaChange("staff")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentPersona === "staff"
                    ? "bg-white text-blue-900 shadow-sm border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Staff View</span>
              </button>

              <button
                onClick={() => onPersonaChange("student")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentPersona === "student"
                    ? "bg-white text-indigo-900 shadow-sm border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Student View</span>
              </button>
            </div>

            {/* Student Dropdown when in Student View */}
            {currentPersona === "student" && (
              <div className="relative flex items-center">
                <select
                  value={selectedStudentId}
                  onChange={(e) => onStudentChange(e.target.value)}
                  className="appearance-none bg-indigo-50/80 hover:bg-indigo-50 border border-indigo-200 text-indigo-950 font-medium text-xs rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer max-w-[200px] sm:max-w-[240px] truncate"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentId}) {s.isOverdue ? "⚠️ Overdue" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-indigo-500 absolute right-2.5 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Institutional Session Bar */}
      <div className="bg-slate-50/80 border-t border-slate-200/70 px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">Active Workspace:</span>
          {currentPersona === "staff" ? (
            <span className="text-slate-900 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              University Academic Registry & Board of Examiners
            </span>
          ) : (
            <span className="text-slate-900 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Student Portal — {activeStudent?.fullName || "Selected Candidate"} ({activeStudent?.studentId})
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-500">
          <span className="font-medium">Academic Year 2024/25</span>
          <span>•</span>
          <span>UK Higher Education Standard</span>
        </div>
      </div>
    </header>
  );
}
