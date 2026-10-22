"use client";

import * as React from "react";
import { Header, StudentOption } from "@/components/header";
import { StudentRegistry, StudentRecord } from "@/components/staff/student-registry";
import { EnrolModal } from "@/components/staff/enrol-modal";
import { RecordPaymentModal } from "@/components/staff/record-payment-modal";
import { AssessmentHub, AssessmentItem } from "@/components/staff/assessment-hub";
import { MarksheetTable } from "@/components/staff/marksheet-table";
import { StudentFinancials } from "@/components/student/student-financials";
import { StudentSubmissions } from "@/components/student/student-submissions";
import { StudentMarksheet } from "@/components/student/student-marksheet";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import {
  Users,
  FileCheck2,
  GraduationCap,
  CreditCard,
  BookOpen,
} from "lucide-react";

interface Programme {
  id: string;
  code: string;
  name: string;
  defaultFee?: number | string;
  modules: Array<{ id: string; code: string; name: string; credits: number }>;
}

export default function SMSDashboardPage() {
  const [currentPersona, setCurrentPersona] = React.useState<"staff" | "student">("staff");
  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [programmes, setProgrammes] = React.useState<Programme[]>([]);
  const [assessments, setAssessments] = React.useState<AssessmentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string>("");

  // Staff sub-tab: 'students' | 'assessments' | 'marksheet'
  const [staffTab, setStaffTab] = React.useState<"students" | "assessments" | "marksheet">("students");

  // Student sub-tab: 'financials' | 'submissions' | 'transcript'
  const [studentTab, setStudentTab] = React.useState<"financials" | "submissions" | "transcript">("financials");

  // Modal states
  const [isEnrolOpen, setIsEnrolOpen] = React.useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [paymentPreselectId, setPaymentPreselectId] = React.useState<string | undefined>(undefined);

  const [loading, setLoading] = React.useState(true);

  // Master Data Refresh for user actions (modals, status toggles)
  const refreshAllData = React.useCallback(async () => {
    try {
      const [pRes, sRes, aRes] = await Promise.all([
        fetch("/api/programmes"),
        fetch("/api/students"),
        fetch("/api/assessments"),
      ]);

      const [pJson, sJson, aJson] = await Promise.all([
        pRes.json(),
        sRes.json(),
        aRes.json(),
      ]);

      if (pJson.success) setProgrammes(pJson.data);
      if (sJson.success) setStudents(sJson.data);
      if (aJson.success) setAssessments(aJson.data);
    } catch (err) {
      console.error("Master data refresh error:", err);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      try {
        const [pRes, sRes, aRes] = await Promise.all([
          fetch("/api/programmes"),
          fetch("/api/students"),
          fetch("/api/assessments"),
        ]);

        const [pJson, sJson, aJson] = await Promise.all([
          pRes.json(),
          sRes.json(),
          aRes.json(),
        ]);

        if (isMounted) {
          if (pJson.success) setProgrammes(pJson.data);
          if (sJson.success) {
            setStudents(sJson.data);
            if (sJson.data.length > 0) {
              setSelectedStudentId((prev) => prev || sJson.data[0].id);
            }
          }
          if (aJson.success) setAssessments(aJson.data);
        }
      } catch (err) {
        console.error("Initial data load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeStudent = students.find((s) => s.id === selectedStudentId);

  // Flatten modules for selectors
  const allModules = programmes.flatMap((p) => p.modules);

  const handleOpenPaymentModal = (studentId?: string) => {
    setPaymentPreselectId(studentId);
    setIsPaymentOpen(true);
  };

  const studentOptions: StudentOption[] = students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    fullName: s.fullName,
    email: s.email,
    status: s.status,
    isOverdue: s.isOverdue,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-slate-700">Connecting to Neon PostgreSQL & SMS Registry Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* 1. INSTITUTIONAL HEADER & PERSONA SWITCHER */}
      <Header
        currentPersona={currentPersona}
        onPersonaChange={setCurrentPersona}
        students={studentOptions}
        selectedStudentId={selectedStudentId}
        onStudentChange={setSelectedStudentId}
      />

      {/* 2. MAIN APPLICATION CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ========================================================= */}
        {/* VIEW 1: UNIVERSITY REGISTRY STAFF DASHBOARD               */}
        {/* ========================================================= */}
        {currentPersona === "staff" ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Staff Navigation Tabs */}
            <div className="flex border-b border-slate-200/80 gap-2 sm:gap-6 text-xs font-semibold">
              <button
                onClick={() => setStaffTab("students")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  staffTab === "students"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Student Registry & Enrolment ({students.length})</span>
              </button>

              <button
                onClick={() => setStaffTab("assessments")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  staffTab === "assessments"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Coursework & Submission Gates ({assessments.length})</span>
              </button>

              <button
                onClick={() => setStaffTab("marksheet")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  staffTab === "marksheet"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Examiner Marksheet & Moderation</span>
              </button>
            </div>

            {/* Staff Tab 1: Student Registry */}
            {staffTab === "students" && (
              <StudentRegistry
                students={students}
                programmes={programmes}
                onRefresh={refreshAllData}
                onOpenEnrolModal={() => setIsEnrolOpen(true)}
                onOpenPaymentModal={handleOpenPaymentModal}
              />
            )}

            {/* Staff Tab 2: Assessment Hub */}
            {staffTab === "assessments" && (
              <AssessmentHub
                assessments={assessments}
                modules={allModules}
                onRefresh={refreshAllData}
              />
            )}

            {/* Staff Tab 3: Marksheet & Moderation */}
            {staffTab === "marksheet" && (
              <MarksheetTable
                assessments={assessments}
                students={students}
                onRefresh={refreshAllData}
              />
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: STUDENT SELF-SERVICE PORTAL                       */
          /* ========================================================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Student Profile Identity Card */}
            {activeStudent && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base">
                    {activeStudent.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{activeStudent.fullName}</h2>
                      <Badge variant="outline" className="font-mono text-xs">
                        {activeStudent.studentId}
                      </Badge>
                      <Badge
                        variant={
                          activeStudent.status === "ENROLLED"
                            ? "emerald"
                            : activeStudent.status === "DEFERRED"
                            ? "amber"
                            : activeStudent.status === "WITHDRAWN"
                            ? "rose"
                            : "primary"
                        }
                      >
                        {activeStudent.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeStudent.programme.name} ({activeStudent.programme.code}) • Academic Year:{" "}
                      {activeStudent.academicYear} • {activeStudent.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Account Balance
                    </p>
                    <p
                      className={`text-base font-bold ${
                        activeStudent.isOverdue
                          ? "text-rose-600"
                          : activeStudent.outstandingBalance <= 0
                          ? "text-emerald-600"
                          : "text-slate-900"
                      }`}
                    >
                      {formatGBP(activeStudent.outstandingBalance)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Student Navigation Sub-tabs */}
            <div className="flex border-b border-slate-200/80 gap-2 sm:gap-6 text-xs font-semibold">
              <button
                onClick={() => setStudentTab("financials")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  studentTab === "financials"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Tuition Fees & Payments</span>
              </button>

              <button
                onClick={() => setStudentTab("submissions")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  studentTab === "submissions"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Coursework Submissions</span>
              </button>

              <button
                onClick={() => setStudentTab("transcript")}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
                  studentTab === "transcript"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Academic Marksheet (Confidential)</span>
              </button>
            </div>

            {/* Student Content Areas */}
            {activeStudent && (
              <>
                {studentTab === "financials" && (
                  <StudentFinancials studentId={activeStudent.id} />
                )}
                {studentTab === "submissions" && (
                  <StudentSubmissions
                    studentId={activeStudent.id}
                    studentProgrammeId={activeStudent.programme.id}
                  />
                )}
                {studentTab === "transcript" && (
                  <StudentMarksheet studentId={activeStudent.id} />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* 3. MODALS */}
      {isEnrolOpen && (
        <EnrolModal
          isOpen={isEnrolOpen}
          onClose={() => setIsEnrolOpen(false)}
          programmes={programmes}
          onSuccess={refreshAllData}
        />
      )}

      {isPaymentOpen && (
        <RecordPaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          students={students}
          preselectedStudentId={paymentPreselectId}
          onSuccess={refreshAllData}
        />
      )}

      {/* 4. INSTITUTIONAL FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            PEN Global Higher Education • Student Management System (Core Registry Module)
          </p>
          <p className="text-slate-400">
            Institutional Registry Standard • UK Degree Framework
          </p>
        </div>
      </footer>
    </div>
  );
}
