import { StudentStatus, AssessmentStatus } from "@prisma/client";

/**
 * Pure domain logic for Coursework Submissions.
 * Enforces institutional submission gates, deadlines, versioning, and file constraints.
 */

export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4.0 MB strict serverless cap

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc"];

export interface StudentEligibilityParams {
  studentStatus: StudentStatus;
  studentProgrammeId: string;
  moduleProgrammeId: string;
}

/**
 * Verifies if a student is permitted to submit work for a given module.
 * Invariant: Must be active (ENROLLED) and enrolled in the module's parent degree programme.
 */
export function checkEligibility(params: StudentEligibilityParams): {
  eligible: boolean;
  statusCode?: number;
  reason?: string;
} {
  if (params.studentStatus !== StudentStatus.ENROLLED) {
    return {
      eligible: false,
      statusCode: 403,
      reason: `Students with status '${params.studentStatus}' are not permitted to submit coursework. Only active ENROLLED students can submit work.`,
    };
  }

  if (params.studentProgrammeId !== params.moduleProgrammeId) {
    return {
      eligible: false,
      statusCode: 403,
      reason: "Student is not enrolled in the degree programme that offers this module.",
    };
  }

  return { eligible: true };
}

/**
 * Determines whether a given submission timestamp is past the assessment deadline.
 */
export function determineLateStatus(
  submittedAt: Date | string,
  deadline: Date | string
): boolean {
  const submitTime = new Date(submittedAt).getTime();
  const deadlineTime = new Date(deadline).getTime();
  return submitTime > deadlineTime;
}

export interface SubmissionGateParams {
  assessmentStatus: AssessmentStatus;
  deadline: Date | string;
  existingSubmission: {
    version: number;
    submittedAt: Date | string;
  } | null;
  now?: Date;
}

export interface SubmissionGateResult {
  allowed: boolean;
  isLate: boolean;
  nextVersion: number;
  statusCode?: number;
  error?: string;
}

/**
 * Evaluates the submission gate according to PEN Global institutional rules.
 * Handles open/closed gating, first submission (on-time or late), and resubmission rules.
 */
export function evaluateSubmissionGate(params: SubmissionGateParams): SubmissionGateResult {
  const now = params.now ?? new Date();
  const deadline = new Date(params.deadline);
  const isPostDeadline = now.getTime() > deadline.getTime();

  // Rule 1: Closed assessments strictly block all submissions
  if (params.assessmentStatus === AssessmentStatus.CLOSED) {
    return {
      allowed: false,
      isLate: isPostDeadline,
      nextVersion: 1,
      statusCode: 403,
      error: "Assessment is officially CLOSED by Registry Staff. No submissions are accepted.",
    };
  }

  // Rule 2: First-time submission
  if (!params.existingSubmission) {
    return {
      allowed: true,
      isLate: isPostDeadline,
      nextVersion: 1,
    };
  }

  // Rule 3: Resubmission flow
  // If before deadline: allow resubmission, increment version
  if (!isPostDeadline) {
    return {
      allowed: true,
      isLate: false,
      nextVersion: params.existingSubmission.version + 1,
    };
  }

  // If post-deadline: strictly reject resubmission (first submission remains official)
  return {
    allowed: false,
    isLate: true,
    nextVersion: params.existingSubmission.version,
    statusCode: 409,
    error: "Resubmission after the assessment deadline is strictly prohibited. Your original submission remains on institutional record.",
  };
}

/**
 * Validates uploaded file constraints (size <= 4MB, MIME type is PDF or DOCX).
 */
export function validateFileConstraints(
  fileSize: number,
  mimeType: string,
  fileName: string
): { valid: boolean; statusCode?: number; error?: string } {
  if (fileSize <= 0) {
    return {
      valid: false,
      statusCode: 400,
      error: "Uploaded file is empty (0 bytes).",
    };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      statusCode: 413,
      error: `File size (${sizeInMb} MB) exceeds the strict 4.0 MB platform limit. Please compress your document before uploading.`,
    };
  }

  const lowerName = fileName.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(mimeType) || mimeType === "application/octet-stream";

  if (!hasValidExtension && !hasValidMime) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid file format '${fileName}'. Only PDF (.pdf) and Word documents (.docx, .doc) are accepted.`,
    };
  }

  return { valid: true };
}
