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

    // Return challenge definition with files, strictly excluding walkthrough, canonical solution, and answer-level hints
    const { walkthrough, canonicalSolution, hints, ...safeChallenge } = challenge as any;

    return NextResponse.json({ challenge: safeChallenge });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch challenge: " + err.message },
      { status: 500 }
    );
  }
}
