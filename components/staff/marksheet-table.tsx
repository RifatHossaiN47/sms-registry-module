"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getClassificationDetails } from "@/lib/results";

interface StudentOption {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  programmeId?: string;
  programme?: { id: string; code: string; name: string };
}

interface AssessmentOption {
  id: string;
  title: string;
  moduleId: string;
  module: {
    code: string;
    name: string;
    programme?: { id?: string; code: string; name: string };
  };
}

interface MarksheetTableProps {
  assessments: AssessmentOption[];
  students: StudentOption[];
  onRefresh: () => void;
}

export function MarksheetTable({ assessments, students, onRefresh }: MarksheetTableProps) {
  const [selectedAssessmentId, setSelectedAssessmentId] = React.useState<string>(
    assessments[0]?.id || ""
  );

  const [scores, setScores] = React.useState<Record<string, { score: string; published: boolean; resultId?: string }>>({});
  const [loading, setLoading] = React.useState(false);
  const [savingStudentId, setSavingStudentId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load existing results whenever assessment changes
  React.useEffect(() => {
    if (!selectedAssessmentId) return;

    async function loadMarks() {
      setLoading(true);
      try {
        const res = await fetch(`/api/results?assessmentId=${selectedAssessmentId}&role=staff`);
        const json = await res.json();
        if (json.success) {
          const map: Record<string, { score: string; published: boolean; resultId?: string }> = {};
          for (const item of json.data) {
            map[item.studentId] = {
              score: item.score.toString(),
              published: item.isPublished,
              resultId: item.id,
            };
          }
          setScores(map);
        }
      } catch (err) {
        console.error("Error loading marksheet:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMarks();
  }, [selectedAssessmentId]);

  const activeAssessment = assessments.find((a) => a.id === selectedAssessmentId);

  // Filter students enrolled in the programme offering this module
  const eligibleStudents = students.filter((s) => {
    if (!activeAssessment?.module?.programme?.id) return true;
    const progId = s.programme?.id || s.programmeId;
    return progId === activeAssessment.module.programme.id;
  });

  const handleScoreChange = (studentId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        score: value,
        published: prev[studentId]?.published || false,
        resultId: prev[studentId]?.resultId,
      },
    }));
  };

  const handleTogglePublish = (studentId: string) => {
    setScores((prev) => {
      const current = prev[studentId] || { score: "", published: false };
      return {
        ...prev,
        [studentId]: {
          ...current,
          published: !current.published,
        },
      };
    });
  };

  const handleSaveResult = async (studentId: string) => {
    const entry = scores[studentId];
    if (!entry || entry.score === "") {
      setFeedback({ type: "error", message: "Please input a valid numeric score (0-100)." });
      return;
    }

    const numericScore = parseInt(entry.score, 10);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      setFeedback({ type: "error", message: "Score must be an integer between 0 and 100." });
      return;
    }

    setSavingStudentId(studentId);
    setFeedback(null);

    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssessmentId,
          studentId,
          score: numericScore,
          published: entry.published,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save mark");
      }

      setFeedback({
        type: "success",
        message: `Grade (${numericScore}) saved successfully. ${entry.published ? "Published to student transcript." : "Withheld from student view."}`,
      });
      onRefresh();
    } catch (err: unknown) {
      setFeedback({ type: "error", message: (err as Error).message });
    } finally {
      setSavingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Assessment Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Examiner Marksheet & Honours Moderation
          </h3>
          <p className="text-xs text-slate-500">
            Enter marks (0–100), view calculated UK degree classifications, and manage publish/withhold gates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Assessment:</label>
          <select
            value={selectedAssessmentId}
            onChange={(e) => setSelectedAssessmentId(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
          >
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.module.code} — {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Marksheet Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Numeric Mark (0–100)</th>
                <th className="px-4 py-3">Honours Classification</th>
                <th className="px-4 py-3 text-center">Publication Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading module candidate marks...
                  </td>
                </tr>
              ) : eligibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No eligible enrolled students found for this module programme.
                  </td>
                </tr>
              ) : (
                eligibleStudents.map((s) => {
                  const entry = scores[s.id] || { score: "", published: false };
                  const numScore = parseInt(entry.score, 10);
                  const isValidScore = !isNaN(numScore) && numScore >= 0 && numScore <= 100;

                  let classificationBadge = null;
                  if (isValidScore) {
                    const details = getClassificationDetails(numScore);
                    classificationBadge = (
                      <Badge variant={details.badgeVariant} className="font-semibold text-[10px]">
                        {details.label}
                      </Badge>
                    );
                  }

                  const isSaving = savingStudentId === s.id;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Candidate */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{s.fullName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{s.studentId}</p>
                      </td>

                      {/* Score Input */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Score"
                            value={entry.score}
                            onChange={(e) => handleScoreChange(s.id, e.target.value)}
                            className="w-20 text-xs font-mono font-bold rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                          />
                          <span className="text-slate-400 font-semibold">/ 100</span>
                        </div>
                      </td>

                      {/* Computed UK Classification */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {classificationBadge || (
                          <span className="text-[11px] text-slate-400 italic">Enter score to preview</span>
                        )}
                      </td>

                      {/* Confidentiality Gate Toggle */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(s.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                            entry.published
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {entry.published ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Published</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              <span>Withheld</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Save Button */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 text-xs px-3"
                          disabled={isSaving || !isValidScore}
                          onClick={() => handleSaveResult(s.id)}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {isSaving ? "Saving..." : "Save Grade"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
