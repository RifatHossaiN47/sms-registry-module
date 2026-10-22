import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssessmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CreateAssessmentSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  moduleId: z.string().uuid("Invalid Module UUID"),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid deadline timestamp"),
  status: z.nativeEnum(AssessmentStatus).optional().default(AssessmentStatus.OPEN),
});

const UpdateAssessmentSchema = z.object({
  id: z.string().uuid("Invalid Assessment UUID"),
  status: z.nativeEnum(AssessmentStatus).optional(),
  deadline: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid deadline timestamp"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");
    const status = searchParams.get("status") as AssessmentStatus | null;

    const where: Prisma.AssessmentWhereInput = {};
    if (moduleId) where.moduleId = moduleId;
    if (status && Object.values(AssessmentStatus).includes(status)) {
      where.status = status;
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        module: {
          select: {
            id: true,
            code: true,
            name: true,
            programme: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        _count: {
          select: {
            submissions: true,
            results: true,
          },
        },
      },
      orderBy: { deadline: "asc" },
    });

    const now = new Date();

    const formatted = assessments.map((a) => ({
      id: a.id,
      title: a.title,
      moduleId: a.moduleId,
      module: a.module,
      deadline: a.deadline.toISOString(),
      status: a.status,
      isPastDeadline: now.getTime() > a.deadline.getTime(),
      submissionsCount: a._count.submissions,
      resultsCount: a._count.results,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("GET /api/assessments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve assessments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateAssessmentSchema.safeParse(body);

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

    const { title, moduleId, deadline, status } = parsed.data;

    const moduleExists = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true },
    });

    if (!moduleExists) {
      return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 });
    }

    const assessment = await prisma.assessment.create({
      data: {
        title,
        moduleId,
        deadline: new Date(deadline),
        status,
      },
      include: {
        module: {
          select: { code: true, name: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Assessment created successfully",
        data: assessment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/assessments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assessment" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateAssessmentSchema.safeParse(body);

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

    const { id, status, deadline } = parsed.data;

    const data: Prisma.AssessmentUpdateInput = {};
    if (status) data.status = status;
    if (deadline) data.deadline = new Date(deadline);

    const updated = await prisma.assessment.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: `Assessment updated successfully`,
      data: updated,
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }
    console.error("PATCH /api/assessments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assessment" },
      { status: 500 }
    );
  }
}
