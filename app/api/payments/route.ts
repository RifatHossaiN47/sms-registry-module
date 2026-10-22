import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBalance, isOverdue, validatePayment } from "@/lib/fees";

const PaymentSubmissionSchema = z.object({
  studentId: z.string().uuid("Invalid Student UUID"),
  amount: z
    .number()
    .positive("Payment amount must be greater than zero"),
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().trim().min(3, "Reference number is required").max(50),
  paymentDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid payment date"),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (studentId) {
      // Query specific student ledger
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          payments: {
            orderBy: { paymentDate: "desc" },
          },
          programme: {
            select: { code: true, name: true },
          },
        },
      });

      if (!student) {
        return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
      }

      const financial = calculateBalance(student.assignedFee, student.payments);
      const overdue = isOverdue(financial.outstandingBalance, student.feeDueDate);

      return NextResponse.json({
        success: true,
        data: {
          student: {
            id: student.id,
            studentId: student.studentId,
            fullName: student.fullName,
            email: student.email,
            programme: student.programme,
            assignedFee: Number(student.assignedFee),
            feeDueDate: student.feeDueDate.toISOString().split("T")[0],
          },
          summary: {
            assignedFee: Number(financial.assignedFee),
            totalPaid: Number(financial.totalPaid),
            outstandingBalance: Number(financial.outstandingBalance),
            isFullyPaid: financial.isFullyPaid,
            isOverdue: overdue,
          },
          payments: student.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            paymentDate: p.paymentDate,
            referenceNumber: p.referenceNumber,
            paymentMethod: p.paymentMethod,
            notes: p.notes,
            createdAt: p.createdAt,
          })),
        },
      });
    }

    // Otherwise return institutional payments ledger
    const payments = await prisma.payment.findMany({
      take: 50,
      orderBy: { paymentDate: "desc" },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: payments.length,
      data: payments.map((p) => ({
        id: p.id,
        studentId: p.studentId,
        student: p.student,
        amount: Number(p.amount),
        paymentDate: p.paymentDate,
        referenceNumber: p.referenceNumber,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve payments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PaymentSubmissionSchema.safeParse(body);

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

    const { studentId, amount, paymentMethod, referenceNumber, paymentDate, notes } = parsed.data;

    // Check duplicate reference number
    const existingRef = await prisma.payment.findUnique({
      where: { referenceNumber },
      select: { id: true },
    });

    if (existingRef) {
      return NextResponse.json(
        { success: false, error: `Payment reference '${referenceNumber}' has already been processed.` },
        { status: 409 }
      );
    }

    // ACID Transaction with Row-Level Locking (SELECT ... FOR UPDATE) to prevent race conditions & overpayments
    const newPayment = await prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive row lock on student record
      const lockedStudents = await tx.$queryRaw<Array<{ id: string; assignedFee: string }>>`
        SELECT "id", "assignedFee"
        FROM "students"
        WHERE "id" = ${studentId}::uuid
        FOR UPDATE;
      `;

      if (lockedStudents.length === 0) {
        throw new Error("STUDENT_NOT_FOUND");
      }

      const assignedFee = new Prisma.Decimal(lockedStudents[0].assignedFee);

      // 2. Sum existing payments inside the lock boundary
      const aggregate = await tx.payment.aggregate({
        where: { studentId },
        _sum: { amount: true },
      });

      const totalPaid = aggregate._sum.amount ?? new Prisma.Decimal(0);
      const outstandingBalance = assignedFee.minus(totalPaid);

      // 3. Validate against overpayment using pure domain function
      const check = validatePayment(amount, outstandingBalance);
      if (!check.valid) {
        throw new Error(`PAYMENT_VALIDATION:${check.code}:${check.error}`);
      }

      // 4. Record payment safely
      return tx.payment.create({
        data: {
          studentId,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          referenceNumber,
          paymentMethod,
          notes: notes || null,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment successfully recorded",
        data: {
          ...newPayment,
          amount: Number(newPayment.amount),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "STUDENT_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    if (err.message?.startsWith("PAYMENT_VALIDATION:")) {
      const parts = err.message.split(":");
      return NextResponse.json({ success: false, error: parts.slice(2).join(":") }, { status: 400 });
    }
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
