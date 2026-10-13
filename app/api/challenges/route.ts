import { NextResponse } from 'next/server';
import { getAllChallenges } from '@/lib/challenges';

/**
 * GET /api/challenges
 *
 * Returns the catalog of active production challenges across all tracks.
 * Query parameters:
 *   ?track=PRODUCTION_SWE | EMBEDDED_SYSTEMS
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const track = url.searchParams.get('track') as 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS' | null;

    const challenges = getAllChallenges(track || undefined).map((c) => ({
      id: c.id,
      track: c.track,
      language: c.language,
      title: c.title,
      repoContext: c.repoContext,
      totalTests: c.totalTests,
      filesCount: c.files.length,
      editableFile: c.files.find((f) => !f.readOnly)?.name ?? '',
      difficulty: c.difficulty,
      estimatedMinutes: c.estimatedMinutes,
      skills: c.skills,
      hiddenTestsCount: c.hiddenTestsCount,
      hasHardwareSimulation: !!c.hardwareContext,
    }));

    return NextResponse.json({
      total: challenges.length,
      challenges,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch challenges: ' + err.message },
      { status: 500 }
    );
  }
}
