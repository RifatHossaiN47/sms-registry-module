import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing submission ID" }, { status: 400 });
    }

    // Explicit projection: Select fileData bytes ONLY in this dedicated streaming endpoint
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        fileData: true,
      },
    });

    if (!submission || !submission.fileData) {
      return NextResponse.json({ success: false, error: "Submission file not found" }, { status: 404 });
    }

    // Convert PostgreSQL ByteA Buffer into response stream
    const buffer = Buffer.from(submission.fileData);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": submission.fileMime || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(submission.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/submissions/download/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to download coursework file" },
      { status: 500 }
    );
  }
}
