import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCohortsForUser, SEEDED_COHORTS } from "@/lib/campus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (((session.user as any).id || (session.user as any).sub) as string) : null;

    if (!userId) {
      // If guest or not logged in, return the seeded university demo cohorts so visitors can explore
      return NextResponse.json({
        cohorts: SEEDED_COHORTS.map((c) => ({
          code: c.code,
          title: c.title,
          department: c.department,
          institution: c.institution,
          instructorId: c.instructorId,
          instructorName: c.instructorName,
          description: c.description,
          createdAt: c.createdAt,
          studentCount: c.studentCount,
          assignmentsCount: c.assignmentsCount,
          isDemo: true,
        })),
        isGuest: true,
      });
    }

    const cohorts = await getCohortsForUser(userId);
    return NextResponse.json({ cohorts, isGuest: false });
  } catch (err: any) {
    console.error("Failed to fetch campus cohorts:", err);
    return NextResponse.json({ error: "Failed to load campus cohorts: " + err.message }, { status: 500 });
  }
}
