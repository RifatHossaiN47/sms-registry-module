"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  FileText,
  Plus,
  Clock,
  Download,
  AlertCircle,
  FolderOpen,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
} from "lucide-react";

interface ModuleOption {
  id: string;
  code: string;
  name: string;
}

export interface AssessmentItem {
  id: string;
  title: string;
  moduleId: string;
  module: {
    code: string;
    name: string;
    programme?: { id?: string; code: string; name: string };
  };
  deadline: string;
  status: "OPEN" | "CLOSED";
  isPastDeadline: boolean;
  submissionsCount: number;
  resultsCount: number;
}

export interface SubmissionItem {
  id: string;
  assessmentId: string;
  studentId: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  version: number;
  submittedAt: string;
  isLate: boolean;
  student: {
    studentId: string;
    fullName: string;
    email: string;
  };
}

interface AssessmentHubProps {
  assessments: AssessmentItem[];
  modules: ModuleOption[];
  onRefresh: () => void;
}

export function AssessmentHub({ assessments, modules, onRefresh }: AssessmentHubProps) {
  const [selectedAssessmentId, setSelectedAssessmentId] = React.useState<string | null>(
    assessments[0]?.id || null
  );
  const [submissions, setSubmissions] = React.useState<SubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = React.useState(false);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [moduleId, setModuleId] = React.useState(modules[0]?.id || "");
  const [deadline, setDeadline] = React.useState("2026-11-20T23:59");
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Status toggle state
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Fetch submissions whenever active assessment changes
  React.useEffect(() => {
    if (!selectedAssessmentId) return;

    let isMounted = true;
    async function fetchSubs() {
      try {
        const res = await fetch(`/api/submissions?assessmentId=${selectedAssessmentId}`);
        const json = await res.json();
        if (isMounted && json.success) {
          setSubmissions(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch submissions:", err);
      } finally {
        if (isMounted) {
          setLoadingSubmissions(false);
        }
      }
    }

    fetchSubs();

    return () => {
      isMounted = false;
    };
  }, [selectedAssessmentId]);

  const handleToggleStatus = async (assessment: AssessmentItem) => {
    setTogglingId(assessment.id);
    const nextStatus = assessment.status === "OPEN" ? "CLOSED" : "OPEN";

    try {
      const res = await fetch("/api/assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assessment.id, status: nextStatus }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Toggle assessment status error:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          moduleId,
          deadline: new Date(deadline).toISOString(),
          status: "OPEN",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create assessment");
      }

      setTitle("");
      setIsCreateOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setCreateError((err as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  const activeAssessment = assessments.find((a) => a.id === selectedAssessmentId);

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Coursework & Assessment Hub</h3>
          <p className="text-xs text-slate-500">
            Define deadlines, toggle registry submission gates (OPEN/CLOSED), and inspect student submissions.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Assessment
        </Button>
      </div>

      {/* Main Grid: Assessments on Left, Submissions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assessment List Cards */}
        <div className="space-y-3 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Assessments ({assessments.length})
          </p>

          <div className="space-y-2.5">
            {assessments.map((a) => {
              const isSelected = a.id === selectedAssessmentId;
              const isOpen = a.status === "OPEN";

              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAssessmentId(a.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/50 border-blue-400 shadow-sm ring-1 ring-blue-400/20"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {a.module.code}
                    </Badge>
                    <Badge variant={isOpen ? "emerald" : "rose"} className="text-[10px]">
                      {isOpen ? "OPEN" : "CLOSED"}
                    </Badge>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{a.title}</h4>

                  <div className="flex items-center text-[11px] text-slate-500 mt-2 gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deadline: {new Date(a.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-600 font-medium">
                      Submissions: <strong className="text-slate-900">{a.submissionsCount}</strong>
                    </span>

                    <button
                      type="button"
                      disabled={togglingId === a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(a);
                      }}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                        isOpen
                          ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      }`}
                    >
                      {isOpen ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Lock Submissions</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Unlock Submissions</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Submissions Review Table for Active Assessment */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Submissions Review {activeAssessment ? `— ${activeAssessment.module.code}` : ""}
            </p>
            {activeAssessment && (
              <Badge variant={activeAssessment.status === "OPEN" ? "emerald" : "rose"}>
                Submissions: {activeAssessment.status === "OPEN" ? "Open" : "Locked"}
              </Badge>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
                Loading submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <FolderOpen className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Submissions Yet</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Enrolled students will appear here once their coursework PDFs are uploaded.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Timeliness</th>
                      <th className="px-4 py-3 text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((sub) => {
                      const sizeInKb = (sub.fileSize / 1024).toFixed(1);

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{sub.student.fullName}</p>
                            <p className="text-[11px] font-mono text-slate-400">{sub.student.studentId}</p>
                          </td>

                          <td className="px-4 py-3 max-w-[200px] truncate">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="font-medium text-slate-800 truncate" title={sub.fileName}>
                                {sub.fileName}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">{sizeInKb} KB</span>
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{sub.version}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-[11px]">
                            {new Date(sub.submittedAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          {/* Dynamic Late Status Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sub.isLate ? (
                              <Badge variant="rose" className="font-bold text-[10px] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                LATE
                              </Badge>
                            ) : (
                              <Badge variant="emerald" className="font-medium text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                On-time
                              </Badge>
                            )}
                          </td>

                          {/* Streaming Download Link */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <a
                              href={`/api/submissions/download/${sub.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                              title="Download binary PDF/DOCX"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE ASSESSMENT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Coursework Assessment"
        description="Schedule a module coursework submission deadline and configure institutional open/close gates."
        maxWidth="md"
      >
        <form onSubmit={handleCreateAssessment} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CS301 Coursework 2: Dynamic Programming"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Module <span className="text-rose-500">*</span>
            </label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Submission Deadline (UTC) <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createLoading}>
              {createLoading ? "Creating..." : "Save Assessment"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
