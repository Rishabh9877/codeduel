import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCohortByCode } from "@/lib/campus";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: "Course code is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user ? (((session.user as any).id || (session.user as any).sub) as string) : undefined;

    const cohort = await getCohortByCode(code, userId);
    if (!cohort) {
      return NextResponse.json({ error: `Course cohort "${code}" not found.` }, { status: 404 });
    }

    return NextResponse.json({ cohort });
  } catch (err: any) {
    console.error("Failed to load cohort details:", err);
    return NextResponse.json(
      { error: "Failed to load cohort: " + err.message },
      { status: 500 }
    );
  }
}
