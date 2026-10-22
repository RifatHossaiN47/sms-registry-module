"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  ShieldCheck,
  Info,
  BookOpen,
} from "lucide-react";

interface StudentMarksheetProps {
  studentId: string;
}

interface ResultRecord {
  id: string;
  score: number;
  classification: "Distinction" | "Merit" | "Pass" | "Fail";
  classificationLabel: string;
  badgeVariant: "emerald" | "blue" | "amber" | "rose";
  publishedAt: string;
  assessment: {
    id: string;
    title: string;
    module: {
      code: string;
      name: string;
      credits: number;
    };
  };
}

export function StudentMarksheet({ studentId }: StudentMarksheetProps) {
  const [results, setResults] = React.useState<ResultRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchMarks() {
      setLoading(true);
      try {
        // CONFIDENTIALITY GATE: role=student guarantees only publishedAt != null records are transmitted
        const res = await fetch(`/api/results?role=student&studentId=${studentId}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data);
        }
      } catch (err) {
        console.error("Failed to load academic marksheet:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMarks();
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
        Loading official transcript...
      </div>
    );
  }

  // Calculate cumulative stats
  const totalCredits = results.reduce((sum, r) => sum + (r.score >= 40 ? r.assessment.module.credits : 0), 0);
  const averageScore =
    results.length > 0
      ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
      : "N/A";

  return (
    <div className="space-y-6">
      {/* Header & Policy Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Official Academic Transcript & Marksheet
          </h3>
          <p className="text-xs text-slate-500">
            Validated results ratified by the University Academic Registry Board.
          </p>
        </div>

        <Badge variant="emerald" className="self-start sm:self-auto text-xs px-3 py-1 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          Official Academic Record
        </Badge>
      </div>

      {/* Institutional Explanatory Notice */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p>
          <strong>Confidentiality Policy:</strong> Provisional marks are withheld from this statement until examiners complete external moderation and registry ratification. If you completed an assessment recently, marks will appear here once officially published.
        </p>
      </div>

      {/* Transcript Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Credits Achieved
          </p>
          <p className="text-2xl font-bold text-slate-900">{totalCredits} CATS</p>
          <p className="text-[11px] text-slate-400">UK Credit Accumulation & Transfer</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Mean Assessment Score
          </p>
          <p className="text-2xl font-bold text-indigo-600">
            {averageScore !== "N/A" ? `${averageScore}%` : "—"}
          </p>
          <p className="text-[11px] text-slate-400">Across {results.length} published module{results.length === 1 ? "" : "s"}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Degree Standing
          </p>
          <div className="pt-1">
            {results.length === 0 ? (
              <span className="text-xs text-slate-400">No ratified grades</span>
            ) : Number(averageScore) >= 70 ? (
              <Badge variant="emerald" className="text-xs px-2.5 py-0.5">
                First Class Honours (1st)
              </Badge>
            ) : Number(averageScore) >= 60 ? (
              <Badge variant="primary" className="text-xs px-2.5 py-0.5">
                Upper Second Class (2:1)
              </Badge>
            ) : Number(averageScore) >= 40 ? (
              <Badge variant="amber" className="text-xs px-2.5 py-0.5">
                Third Class / Pass
              </Badge>
            ) : (
              <Badge variant="rose" className="text-xs px-2.5 py-0.5">
                Fail / Re-sit Required
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">UK University Grading Framework</p>
        </div>
      </div>

      {/* Ratified Grades Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Assessment Title</th>
                <th className="px-4 py-3 text-center">Credits</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3">UK Classification</th>
                <th className="px-4 py-3 text-right">Publication Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No ratified academic grades are currently published for your record.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-900">{r.assessment.module.code}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{r.assessment.module.name}</p>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.assessment.title}
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-600">
                      {r.assessment.module.credits}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {r.score}
                      </span>
                      <span className="text-[10px] text-slate-400"> / 100</span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={r.badgeVariant} className="text-[10px] font-semibold">
                        {r.classificationLabel}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(r.publishedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
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
