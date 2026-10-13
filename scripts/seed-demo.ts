import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { dynamo, TABLE } from "../lib/dynamo";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SEEDED_COHORTS } from "../lib/campus";
import { SEED_CHALLENGES } from "../lib/challenges";

async function seedDemoData() {
  console.log("=================================================");
  console.log("CODEDUEL DEMO SEEDER (POSTGRES / DYNAMO / LOCAL)");
  console.log("=================================================\n");

  // 1. Seed Top Competitors on Leaderboard (High-tier verified engineers)
  const topEngineers = [
    {
      userId: "eng_101",
      username: "Linus_KernelDev",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Linus",
      elo: 2420,
      wins: 88,
      losses: 12,
      track: "EMBEDDED_SYSTEMS",
      skills: ["UART Ring Buffer", "Volatile Race", "Memory Alignment", "Cortex HardFault"],
    },
    {
      userId: "eng_102",
      username: "CloudNative_Ace",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Cloud",
      elo: 2315,
      wins: 76,
      losses: 14,
      track: "PRODUCTION_SWE",
      skills: ["Token Bucket", "JWT Replay", "LRU Cache", "Postgres Deadlock"],
    },
    {
      userId: "eng_103",
      username: "Silicon_Carmack",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=John",
      elo: 2280,
      wins: 69,
      losses: 15,
      track: "EMBEDDED_SYSTEMS",
      skills: ["SPI Endianness", "PWM Prescaler", "Debounce FSM"],
    },
    {
      userId: "eng_104",
      username: "Tokio_AsyncMaster",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tokio",
      elo: 2190,
      wins: 54,
      losses: 18,
      track: "PRODUCTION_SWE",
      skills: ["WebSocket Backoff", "Payment Mutex", "Rate Limiter"],
    },
    {
      userId: "eng_105",
      username: "Firmware_Ghost",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Ghost",
      elo: 2105,
      wins: 48,
      losses: 20,
      track: "EMBEDDED_SYSTEMS",
      skills: ["Interrupt Race", "GPIO Debounce", "MMIO Registers"],
    },
  ];

  console.log("1. Seeding verified competitors...");
  for (const eng of topEngineers) {
    // Put Profile
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${eng.userId}`,
          SK: "PROFILE",
          userId: eng.userId,
          username: eng.username,
          avatar: eng.avatar,
          elo: eng.elo,
          wins: eng.wins,
          losses: eng.losses,
          skillsPracticed: eng.skills,
          streak: Math.floor(Math.random() * 15) + 5,
          createdAt: Date.now() - 86400000 * 60,
          isPublic: true,
          showMatchHistory: true,
        },
      })
    );

    // Put Leaderboard GSI
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${eng.userId}`,
          SK: "LEADERBOARD",
          GSI1PK: "LEADERBOARD#GLOBAL",
          GSI1SK: eng.elo,
          userId: eng.userId,
          username: eng.username,
          avatar: eng.avatar,
          track: eng.track,
          wins: eng.wins,
          losses: eng.losses,
        },
      })
    );
    console.log(`   ✓ Seeded ${eng.username} (${eng.elo} ELO, ${eng.track})`);
  }

  // 2. Seed Campus Cohorts & Lab Assignments
  console.log("\n2. Seeding Campus Cohorts & Labs...");
  for (const cohort of SEEDED_COHORTS) {
    // Cohort Metadata
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `COHORT#${cohort.code}`,
          SK: "METADATA",
          code: cohort.code,
          title: cohort.title,
          department: cohort.department,
          institution: cohort.institution,
          instructorId: cohort.instructorId,
          instructorName: cohort.instructorName,
          description: cohort.description,
          createdAt: cohort.createdAt,
          studentCount: cohort.studentCount,
          assignmentsCount: cohort.assignmentsCount,
        },
      })
    );
    console.log(`   ✓ Seeded Cohort ${cohort.code}: ${cohort.title}`);

    // Assignments
    for (const asg of cohort.assignments) {
      await dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `COHORT#${cohort.code}`,
            SK: `ASSIGNMENT#${asg.assignmentId}`,
            assignmentId: asg.assignmentId,
            title: asg.title,
            challengeId: asg.challengeId,
            dueDate: asg.dueDate,
            track: asg.track,
            difficulty: asg.difficulty,
            points: asg.points,
            createdAt: asg.createdAt,
          },
        })
      );
    }
    console.log(`     - Seeded ${cohort.assignments.length} assignments for ${cohort.code}`);
  }

  // 3. Verify Challenges Count
  const challengeCount = Object.keys(SEED_CHALLENGES).length;
  console.log(`\n3. Curriculum Verification: ${challengeCount} incident challenges active.`);

  console.log("\n=================================================");
  console.log("DEMO SEED COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

seedDemoData().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
