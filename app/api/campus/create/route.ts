import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCohort } from "@/lib/campus";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please log in to create a campus course." }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const userName = session.user.name || "Faculty Instructor";

    const body = await req.json();
    const { code, title, department, institution, description, facultyPasscode } = body;

    // Faculty Verification Guard: ensure caller is an instructor or platform admin
    const profileRes = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
    );
    const userRole = profileRes.Item?.role || (session.user as any).role || "INDIVIDUAL";
    const isAdmin = userRole === "ADMIN";
    const expectedPasscode = process.env.FACULTY_SECRET ? process.env.FACULTY_SECRET.trim().toUpperCase() : null;
    const isPasscodeValid = Boolean(
      expectedPasscode &&
      facultyPasscode &&
      facultyPasscode.trim().toUpperCase() === expectedPasscode
    );

    // .edu email alone does NOT grant faculty; must be existing verified FACULTY/ADMIN or supply valid FACULTY_SECRET
    if (!isAdmin && userRole !== "FACULTY" && !isPasscodeValid) {
      return NextResponse.json(
        {
          error:
            "Access Denied: Only verified faculty instructors can create university course cohorts. Please provide a valid Faculty Verification Key from your department administrator.",
        },
        { status: 403 }
      );
    }

    if (!code || !title || !institution) {
      return NextResponse.json(
        { error: "Course code, title, and institution are required." },
        { status: 400 }
      );
    }

    const cohort = await createCohort({
      code,
      title,
      department: department || "Engineering",
      institution,
      instructorId: userId,
      instructorName: userName,
      description: description || "Interactive low-level firmware and software debugging labs.",
    });

    return NextResponse.json({ success: true, cohort });
  } catch (err: any) {
    console.error("Failed to create course cohort:", err);
    return NextResponse.json(
      { error: "Failed to create course cohort: " + err.message },
      { status: 500 }
    );
  }
}
