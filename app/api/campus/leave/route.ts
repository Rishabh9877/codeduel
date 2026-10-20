import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leaveCohort } from "@/lib/campus";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? (((session.user as any).id || (session.user as any).sub) as string)
      : null;

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Course code is required." }, { status: 400 });
    }

    if (userId) {
      await leaveCohort(code, userId);
    }

    return NextResponse.json({ success: true, code: code.toUpperCase().trim() });
  } catch (err: any) {
    console.error("Failed to leave course cohort:", err);
    return NextResponse.json(
      { error: err.message || "Failed to exit course." },
      { status: 400 }
    );
  }
}
