"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Lock,
} from "lucide-react";

interface StudentSubmissionsProps {
  studentId: string;
  studentProgrammeId: string;
}

interface RawAssessment {
  id: string;
  title: string;
  moduleId: string;
  deadline: string;
  status: "OPEN" | "CLOSED";
  isPastDeadline: boolean;
  module: {
    code: string;
    name: string;
    programme?: { id: string; code: string; name: string };
  };
}

interface AssessmentWithSubmission {
  id: string;
  title: string;
  moduleId: string;
  deadline: string;
  status: "OPEN" | "CLOSED";
  isPastDeadline: boolean;
  module: {
    code: string;
    name: string;
    programme?: { id: string; code: string; name: string };
  };
  submission?: {
    id: string;
    fileName: string;
    fileSize: number;
    fileMime: string;
    version: number;
    submittedAt: string;
    isLate: boolean;
  } | null;
}

export function StudentSubmissions({ studentId, studentProgrammeId }: StudentSubmissionsProps) {
  const [assessments, setAssessments] = React.useState<AssessmentWithSubmission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [feedback, setFeedback] = React.useState<{ id: string; type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const aRes = await fetch("/api/assessments");
        const aJson = await aRes.json();

        const sRes = await fetch(`/api/submissions?studentId=${studentId}`);
        const sJson = await sRes.json();

        if (!ignore && aJson.success && sJson.success) {
          const subMap = new Map<
            string,
            {
              id: string;
              fileName: string;
              fileSize: number;
              fileMime: string;
              version: number;
              submittedAt: string;
              isLate: boolean;
            }
          >();

          for (const sub of sJson.data) {
            subMap.set(sub.assessmentId, sub);
          }

          const enriched: AssessmentWithSubmission[] = (aJson.data as RawAssessment[])
            .filter((a) => {
              if (!a.module?.programme?.id) return true;
              return a.module.programme.id === studentProgrammeId;
            })
            .map((a) => ({
              ...a,
              submission: subMap.get(a.id) || null,
            }));

          setAssessments(enriched);
        }
      } catch (err) {
        console.error("Failed to load coursework:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [studentId, studentProgrammeId, refreshTrigger]);

  const handleFileUpload = async (assessmentId: string, file: File) => {
    setFeedback(null);

    // Client-side 4MB pre-flight check
    if (file.size > 4 * 1024 * 1024) {
      setFeedback({
        id: assessmentId,
        type: "error",
        message: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the platform 4.0 MB limit.`,
      });
      return;
    }

    setUploadingId(assessmentId);

    try {
      const formData = new FormData();
      formData.append("assessmentId", assessmentId);
      formData.append("studentId", studentId);
      formData.append("file", file);

      const res = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }

      setFeedback({
        id: assessmentId,
        type: "success",
        message: json.message || "Coursework submitted successfully!",
      });

      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setFeedback({
        id: assessmentId,
        type: "error",
        message: (err as Error).message,
      });
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
        Loading module coursework assessments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Coursework Submission Portal</h3>
        <p className="text-xs text-slate-500">
          Upload PDF or DOCX assessment solutions. Late submissions are accepted if the registry gate remains OPEN. Max file size: 4.0 MB.
        </p>
      </div>

      <div className="space-y-4">
        {assessments.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
            No coursework assessments currently scheduled for your degree programme.
          </div>
        ) : (
          assessments.map((a) => {
            const hasSubmitted = !!a.submission;
            const isClosed = a.status === "CLOSED";
            const deadlineDate = new Date(a.deadline);
            const isPastDeadline = new Date().getTime() > deadlineDate.getTime();
            const isBlockedResubmit = hasSubmitted && isPastDeadline;

            const isUploading = uploadingId === a.id;
            const currentFeedback = feedback?.id === a.id ? feedback : null;

            return (
              <div
                key={a.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all ${
                  isClosed ? "border-slate-200 bg-slate-50/40" : "border-slate-200"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {a.module.code}
                      </Badge>
                      <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{a.module.name}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={isClosed ? "rose" : "emerald"} className="text-[10px]">
                      {isClosed ? "SUBMISSIONS CLOSED" : "SUBMISSIONS OPEN"}
                    </Badge>
                  </div>
                </div>

                {/* Deadline & Policy Status */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 my-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Deadline:{" "}
                      <strong className={isPastDeadline ? "text-rose-600 font-semibold" : "text-slate-800"}>
                        {deadlineDate.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </span>
                  </div>

                  {isPastDeadline && !isClosed && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Post-deadline period: Submissions will be flagged as LATE
                    </span>
                  )}
                </div>

                {/* Feedback Callout */}
                {currentFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 my-3 border ${
                      currentFeedback.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    {currentFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{currentFeedback.message}</span>
                  </div>
                )}

                {/* Current Submission Status Receipt */}
                {hasSubmitted && a.submission && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl my-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-xs">
                            {a.submission.fileName}
                          </span>
                          <Badge variant="outline" className="font-mono text-[9px]">
                            v{a.submission.version}
                          </Badge>
                          {a.submission.isLate ? (
                            <Badge variant="rose" className="text-[9px]">
                              LATE
                            </Badge>
                          ) : (
                            <Badge variant="emerald" className="text-[9px]">
                              ON-TIME
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Submitted on{" "}
                          {new Date(a.submission.submittedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          ({(a.submission.fileSize / 1024).toFixed(1)} KB)
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/api/submissions/download/${a.submission.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-300 text-xs font-medium shadow-xs transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Receipt
                    </a>
                  </div>
                )}

                {/* Upload Action Interface */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {isClosed ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100/60 p-3 rounded-lg">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Submissions Closed: The Examination Board has locked this assessment. No submissions or modifications are permitted.
                      </span>
                    </div>
                  ) : isBlockedResubmit ? (
                    <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Resubmission Deadline Passed: Institutional regulations prohibit overwriting coursework after the deadline. Your original submission (v{a.submission?.version}) remains official.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl p-4 transition-all cursor-pointer">
                        <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-700">
                          {hasSubmitted
                            ? "Click to upload a revised submission (Increments to v" +
                              ((a.submission?.version || 1) + 1) +
                              ")"
                            : "Click to upload your coursework solution (PDF / DOCX)"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Maximum file size 4.0 MB • Encrypted ByteA binary storage
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(a.id, file);
                          }}
                        />
                      </label>
                      {isUploading && (
                        <p className="text-xs text-blue-600 mt-2 text-center animate-pulse font-medium">
                          Uploading & validating binary coursework...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
