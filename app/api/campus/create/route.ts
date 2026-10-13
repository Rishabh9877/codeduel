import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCohort } from "@/lib/campus";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please log in to create a campus course." }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const userName = session.user.name || "Faculty Instructor";

    const body = await req.json();
    const { code, title, department, institution, description } = body;

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
