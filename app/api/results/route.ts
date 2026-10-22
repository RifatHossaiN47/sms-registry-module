import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateClassification,
  getClassificationDetails,
  canViewAcademicTranscript,
} from "@/lib/results";

const CreateResultSchema = z.object({
  assessmentId: z.string().uuid("Invalid Assessment UUID"),
  studentId: z.string().uuid("Invalid Student UUID"),
  score: z
    .number()
    .int("Score must be an integer")
    .min(0, "Score cannot be less than 0")
    .max(100, "Score cannot exceed 100"),
  published: z.boolean().optional().default(false),
});

const UpdateResultSchema = z.object({
  id: z.string().uuid("Invalid Result UUID"),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional(),
  published: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get("assessmentId");
    const studentId = searchParams.get("studentId");
    const role = searchParams.get("role") || "staff"; // 'staff' | 'student'

    const where: Prisma.ResultWhereInput = {};
    if (assessmentId) where.assessmentId = assessmentId;
    if (studentId) where.studentId = studentId;

    // CONFIDENTIALITY GATE: If student view, strictly withhold unmoderated marks (publishedAt != null)
    if (role === "student") {
      if (!studentId) {
        return NextResponse.json(
          { success: false, error: "studentId is required for student role query" },
          { status: 400 }
        );
      }

      // Check student transcript eligibility
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { status: true },
      });

      if (!student || !canViewAcademicTranscript(student.status)) {
        return NextResponse.json(
          { success: false, error: "Student not permitted to view transcript" },
          { status: 403 }
        );
      }

      where.publishedAt = { not: null };
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            deadline: true,
            status: true,
            module: {
              select: { code: true, name: true, credits: true },
            },
          },
        },
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Dynamically compute UK degree classification (Zero Stored Computed State)
    const formatted = results.map((r) => {
      const details = getClassificationDetails(r.score);
      return {
        id: r.id,
        assessmentId: r.assessmentId,
        studentId: r.studentId,
        score: r.score,
        classification: details.classification,
        classificationLabel: details.label,
        badgeVariant: details.badgeVariant,
        publishedAt: r.publishedAt,
        isPublished: r.publishedAt !== null,
        assessment: r.assessment,
        student: r.student,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("GET /api/results error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve results" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { assessmentId, studentId, score, published } = parsed.data;

    // Verify student and assessment exist
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }

    const publishedAt = published ? new Date() : null;

    // Upsert result record
    const result = await prisma.result.upsert({
      where: {
        assessmentId_studentId: { assessmentId, studentId },
      },
      create: {
        assessmentId,
        studentId,
        score,
        publishedAt,
      },
      update: {
        score,
        publishedAt: published !== undefined ? publishedAt : undefined,
      },
    });

    const classification = calculateClassification(result.score);

    return NextResponse.json(
      {
        success: true,
        message: "Grade recorded successfully",
        data: {
          ...result,
          classification,
          isPublished: result.publishedAt !== null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/results error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record result" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, score, published } = parsed.data;

    const updateData: Prisma.ResultUpdateInput = {};
    if (score !== undefined) {
      updateData.score = score;
    }
    if (published !== undefined) {
      updateData.publishedAt = published ? new Date() : null;
    }

    const updated = await prisma.result.update({
      where: { id },
      data: updateData,
    });

    const classification = calculateClassification(updated.score);

    return NextResponse.json({
      success: true,
      message: "Result updated successfully",
      data: {
        ...updated,
        classification,
        isPublished: updated.publishedAt !== null,
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ success: false, error: "Result not found" }, { status: 404 });
    }
    console.error("PATCH /api/results error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update result" },
      { status: 500 }
    );
  }
}
