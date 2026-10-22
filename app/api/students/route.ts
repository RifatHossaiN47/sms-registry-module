import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StudentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBalance, isOverdue } from "@/lib/fees";

const EnrolmentSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(100),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Date of Birth"),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{2}$/, "Academic year must match format YYYY/YY (e.g. 2024/25)"),
  programmeId: z.string().uuid("Invalid Programme UUID"),
  feeDueDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Fee Due Date"),
});

const StatusUpdateSchema = z.object({
  id: z.string().uuid("Invalid Student UUID"),
  status: z.nativeEnum(StudentStatus),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const programmeId = searchParams.get("programmeId") || "";
    const status = searchParams.get("status") as StudentStatus | null;
    const overdueOnly = searchParams.get("overdueOnly") === "true";

    const where: Prisma.StudentWhereInput = {};

    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { studentId: { contains: q, mode: "insensitive" } },
      ];
    }

    if (programmeId) {
      where.programmeId = programmeId;
    }

    if (status && Object.values(StudentStatus).includes(status)) {
      where.status = status;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        programme: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: { studentId: "asc" },
    });

    const now = new Date();

    // Map each student with pure runtime financial calculations (Zero Stored State)
    const enrichedStudents = students.map((s) => {
      const financial = calculateBalance(s.assignedFee, s.payments);
      const overdue = isOverdue(financial.outstandingBalance, s.feeDueDate, now);

      return {
        id: s.id,
        studentId: s.studentId,
        fullName: s.fullName,
        email: s.email,
        dateOfBirth: s.dateOfBirth.toISOString().split("T")[0],
        academicYear: s.academicYear,
        status: s.status,
        programme: s.programme,
        assignedFee: Number(s.assignedFee),
        feeDueDate: s.feeDueDate.toISOString().split("T")[0],
        totalPaid: Number(financial.totalPaid),
        outstandingBalance: Number(financial.outstandingBalance),
        isOverdue: overdue,
        createdAt: s.createdAt,
      };
    });

    // If filtered by overdueOnly, apply in-memory filter on dynamically computed flag
    const filtered = overdueOnly
      ? enrichedStudents.filter((s) => s.isOverdue)
      : enrichedStudents;

    return NextResponse.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching students" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EnrolmentSchema.safeParse(body);

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

    const { fullName, email, dateOfBirth, academicYear, programmeId, feeDueDate } = parsed.data;

    // Check email uniqueness
    const existingEmail = await prisma.student.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: `Student with email '${email}' is already enrolled.` },
        { status: 409 }
      );
    }

    // Retrieve programme for fee snapshot
    const programme = await prisma.programme.findUnique({
      where: { id: programmeId },
    });

    if (!programme) {
      return NextResponse.json(
        { success: false, error: "Specified degree programme not found." },
        { status: 404 }
      );
    }

    // Determine enrolment year for sequential counter (e.g. "2025" from "2024/25" or current year)
    const yearMatch = academicYear.match(/^(\d{4})/);
    const enrolmentYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // Concurrency-safe atomic student enrolment transaction
    const newStudent = await prisma.$transaction(async (tx) => {
      // Atomic upsert on sequential ID counter
      const counter = await tx.studentIdCounter.upsert({
        where: { year: enrolmentYear },
        create: { year: enrolmentYear, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const sequentialId = `SMS-${enrolmentYear}-${String(counter.lastNumber).padStart(4, "0")}`;

      return tx.student.create({
        data: {
          studentId: sequentialId,
          fullName,
          email,
          dateOfBirth: new Date(dateOfBirth),
          academicYear,
          status: StudentStatus.ENROLLED,
          programmeId,
          assignedFee: programme.defaultFee, // Immutable snapshot copied at enrolment
          feeDueDate: new Date(feeDueDate),
        },
        include: {
          programme: {
            select: { id: true, code: true, name: true },
          },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Student enrolled successfully",
        data: {
          ...newStudent,
          assignedFee: Number(newStudent.assignedFee),
          outstandingBalance: Number(newStudent.assignedFee),
          totalPaid: 0,
          isOverdue: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/students error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to enroll student." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StatusUpdateSchema.safeParse(body);

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

    const { id, status } = parsed.data;

    const updated = await prisma.student.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        studentId: true,
        fullName: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Student status updated to '${status}'`,
      data: updated,
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    console.error("PATCH /api/students error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update student status" },
      { status: 500 }
    );
  }
}
