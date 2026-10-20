import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getCohortsForUser, SEEDED_COHORTS } from "@/lib/campus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (((session.user as any).id || (session.user as any).sub) as string) : null;

    if (!userId) {
      const demoList = SEEDED_COHORTS.map((c) => ({
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
      }));
      return NextResponse.json({
        cohorts: demoList,
        demoCohorts: demoList,
        isGuest: true,
      });
    }

    const userRes = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      })
    ).catch(() => ({ Item: null }));

    const activeRole = userRes.Item?.role || (session.user as any).role || "INDIVIDUAL";
    const isAdmin = activeRole === "ADMIN";
    const cohorts = await getCohortsForUser(userId, isAdmin);
    return NextResponse.json({
      cohorts,
      demoCohorts: SEEDED_COHORTS.map((c) => ({
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
      })),
      isGuest: false,
    });
  } catch (err: any) {
    console.error("Failed to fetch campus cohorts:", err);
    return NextResponse.json({ error: "Failed to load campus cohorts: " + err.message }, { status: 500 });
  }
}
