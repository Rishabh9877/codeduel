import { NextResponse } from "next/server";
import { getChallengeById } from "@/lib/challenges";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenge = getChallengeById(id);

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Return challenge definition with files, excluding walkthrough upfront
    const { walkthrough, ...safeChallenge } = challenge;

    return NextResponse.json({ challenge: safeChallenge });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch challenge: " + err.message },
      { status: 500 }
    );
  }
}
