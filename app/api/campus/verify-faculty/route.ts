import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const passcode = (body.passcode || "").trim().toUpperCase();
    const expected = (process.env.FACULTY_SECRET || "CODEDUEL-FACULTY-2026").toUpperCase();

    if (passcode === expected) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json(
      { error: "Invalid faculty verification key. Please check your credentials or sign in with your official university email." },
      { status: 403 }
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
