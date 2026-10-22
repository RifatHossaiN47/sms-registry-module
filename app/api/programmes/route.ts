import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const programmes = await prisma.programme.findMany({
      include: {
        modules: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
          },
          orderBy: { code: "asc" },
        },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, data: programmes });
  } catch (error) {
    console.error("GET /api/programmes error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch programmes" },
      { status: 500 }
    );
  }
}
