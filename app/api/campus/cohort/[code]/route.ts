import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCohortByCode, SEEDED_COHORTS } from "@/lib/campus";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

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

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // "roster" | "gradebook" | "csv"

    const session = await getServerSession(authOptions);
    const userId = session?.user ? (((session.user as any).id || (session.user as any).sub) as string) : undefined;

    const cohort = await getCohortByCode(code, userId);
    if (!cohort) {
      return NextResponse.json({ error: `Course cohort "${code}" not found.` }, { status: 404 });
    }

    // Server-side role check: determine if caller is authorized faculty or admin
    let userRole = "STUDENT";
    if (userId) {
      try {
        const profRes = await dynamo.send(
          new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
        );
        userRole = profRes.Item?.role || (session?.user as any)?.role || "STUDENT";
      } catch (err) {
        userRole = (session?.user as any)?.role || "STUDENT";
      }
    }

    // Explicit server-side DEMO_MODE path:
    // When DEMO_MODE is active, a dedicated demo faculty user (faculty_vikram_malhotra) or explicit
    // demoFaculty preview on seeded demo cohorts is recognized as instructor by the server.
    const isProduction = process.env.NODE_ENV === "production";
    const isServerDemoMode = process.env.DEMO_MODE === "true" || (!isProduction && process.env.NEXT_PUBLIC_DEMO_MODE === "true");
    const isDemoFacultyUser = userId === "faculty_vikram_malhotra" || userId === "demo_faculty";
    const isDemoCohort = Boolean(cohort.isDemo || SEEDED_COHORTS.some((sc) => sc.code === cohort.code));

    // Strict security guarantee: Demo faculty identity can NEVER access real institutional cohorts
    if (!isDemoCohort && isDemoFacultyUser) {
      return NextResponse.json(
        { error: "Forbidden: Demo faculty accounts are restricted exclusively to seeded demo cohorts." },
        { status: 403 }
      );
    }

    const isDemoFacultyPreview = isServerDemoMode && isDemoCohort && (isDemoFacultyUser || searchParams.get("demoFaculty") === "true");

    const isInstructor = Boolean(userId && cohort.instructorId === userId) || isDemoFacultyPreview;
    const isPrivileged = userRole === "FACULTY" || userRole === "ADMIN" || isInstructor;

    // Explicit requests for roster, gradebook, or CSV export MUST reject students with 403
    if (view === "roster" || view === "gradebook" || view === "csv") {
      if (!isPrivileged) {
        return NextResponse.json(
          {
            error: "Forbidden: Cohort rosters, gradebooks, and student performance telemetry are restricted to verified faculty instructors and administrators.",
          },
          { status: 403 }
        );
      }

      if (view === "csv") {
        const headers = [
          "Student_Name",
          "Student_ID",
          "Cohort_Code",
          "Course_Title",
          "Labs_Completed",
          "Total_Labs",
          "Score_Percentage",
          "Current_ELO",
          "Integrity_Score",
          "Tab_Switches",
          "Proctor_Status",
          "Enrolled_Date",
          "Status",
          "Data_Mode",
        ];

        const rows = (cohort.students || []).map((s) => {
          const completed = s.completedAssignmentsCount || 0;
          const totalLabs = cohort.assignmentsCount || cohort.assignments?.length || 1;
          const scorePercent = Math.round((completed / Math.max(1, totalLabs)) * 100);
          const integrityScore = (s as any).integrityScore ?? 96;
          const tabSwitches = (s as any).tabSwitches ?? 0;
          const proctorStatus = (s as any).proctorStatus || (tabSwitches > 4 ? "Flagged" : "Clear");
          const enrolled = s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : "Active";
          const status = completed >= totalLabs ? "COMPLETED" : "IN_PROGRESS";
          return [
            `"${(s.username || "Student").replace(/"/g, '""')}"`,
            `"${s.userId}"`,
            `"${cohort.code}"`,
            `"${cohort.title.replace(/"/g, '""')}"`,
            completed,
            totalLabs,
            `${scorePercent}%`,
            s.elo,
            `"${integrityScore}%"`,
            tabSwitches,
            `"${proctorStatus}"`,
            `"${enrolled}"`,
            `"${status}"`,
            `"${cohort.isDemo ? "SAMPLE DEMO DATA" : "AUTHENTIC"}"`,
          ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        return new Response(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${cohort.code}_Official_Gradebook.csv"`,
          },
        });
      }
    }

    // For general cohort retrieval, if the caller is NOT privileged (i.e. student or unauthenticated),
    // sanitize the response to completely strip the student roster and cohort-wide submissions
    if (!isPrivileged) {
      const sanitizedCohort = {
        ...cohort,
        students: [],
        allSubmissions: [],
        stats: undefined,
      };
      return NextResponse.json({ cohort: sanitizedCohort });
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
