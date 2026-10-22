import { StudentStatus } from "@prisma/client";

/**
 * Pure domain logic for UK Academic Marksheets & Degree Classifications.
 * Invariant: Classifications are never stored as database columns; they are computed dynamically.
 */

export type DegreeClassification = "Distinction" | "Merit" | "Pass" | "Fail";

export interface ClassificationDetails {
  classification: DegreeClassification;
  label: string;
  badgeVariant: "emerald" | "blue" | "amber" | "rose";
  description: string;
}

/**
 * Computes standard UK University Honours classification based on numeric score (0-100).
 * Thresholds:
 * - 70-100: Distinction (First Class Honours equivalent)
 * - 60-69:  Merit (Upper Second Class / 2:1 equivalent)
 * - 40-59:  Pass (Honours Pass / 2:2 / Third equivalent)
 * - 0-39:   Fail
 */
export function calculateClassification(score: number): DegreeClassification {
  if (typeof score !== "number" || isNaN(score)) {
    throw new TypeError("Grade score must be a valid number.");
  }

  if (score < 0 || score > 100) {
    throw new RangeError(`Grade score (${score}) is invalid. Must be between 0 and 100.`);
  }

  if (score >= 70) return "Distinction";
  if (score >= 60) return "Merit";
  if (score >= 40) return "Pass";
  return "Fail";
}

/**
 * Returns detailed classification metadata including presentation styles and UK academic context.
 */
export function getClassificationDetails(score: number): ClassificationDetails {
  const classification = calculateClassification(score);

  switch (classification) {
    case "Distinction":
      return {
        classification,
        label: "Distinction (1st Class)",
        badgeVariant: "emerald",
        description: "Outstanding academic performance exceeding institutional criteria.",
      };
    case "Merit":
      return {
        classification,
        label: "Merit (Upper 2nd / 2:1)",
        badgeVariant: "blue",
        description: "High standard of technical competence and analytical depth.",
      };
    case "Pass":
      return {
        classification,
        label: "Pass (3rd / 2:2)",
        badgeVariant: "amber",
        description: "Satisfactory attainment meeting minimum degree credit requirements.",
      };
    case "Fail":
      return {
        classification,
        label: "Fail (< 40)",
        badgeVariant: "rose",
        description: "Unsatisfactory completion. Re-assessment or module repeat required.",
      };
  }
}

/**
 * Determines whether a mark is officially published and safe for student dissemination.
 * Confidentiality Rule: If publishedAt is null or undefined, the mark is withheld.
 */
export function isResultPublished(publishedAt: Date | string | null | undefined): boolean {
  return publishedAt !== null && publishedAt !== undefined;
}

/**
 * Pure filter function ensuring students only receive published results.
 * Strips unmoderated grades to prevent wire leakage.
 */
export function filterStudentResults<T extends { publishedAt: Date | string | null | undefined }>(
  results: T[]
): T[] {
  return results.filter((r) => isResultPublished(r.publishedAt));
}

/**
 * Policy rule: Determines if a student has permission to view their academic transcript.
 * Invariant: Withdrawn and completed students maintain indefinite access to past published credits.
 */
export function canViewAcademicTranscript(status: StudentStatus): boolean {
  // All recorded student statuses can view their historical published marks
  return [
    StudentStatus.ENROLLED,
    StudentStatus.DEFERRED,
    StudentStatus.WITHDRAWN,
    StudentStatus.COMPLETED,
  ].includes(status);
}
