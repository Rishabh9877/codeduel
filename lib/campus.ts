import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export interface CohortAssignment {
  assignmentId: string;
  title: string;
  challengeId: string;
  dueDate: string;
  track: "EMBEDDED_SYSTEMS" | "PRODUCTION_SWE";
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  createdAt: string;
}

export interface CohortStudent {
  userId: string;
  username: string;
  avatar: string | null;
  elo: number;
  enrolledAt: string;
  role: "STUDENT" | "TA" | "FACULTY";
  completedAssignmentsCount: number;
}

export interface Cohort {
  code: string;
  title: string;
  department: string;
  institution: string;
  instructorId: string;
  instructorName: string;
  description: string;
  createdAt: string;
  studentCount: number;
  assignmentsCount: number;
  isDemo?: boolean;
}

// ── Default Seeded Academic Cohorts for Demos ──────────────────────────────────
export const SEEDED_COHORTS: Array<Cohort & { assignments: CohortAssignment[]; students: CohortStudent[] }> = [
  {
    code: "ECE-301-EMBEDDED",
    title: "ECE-301: Microcontrollers & Real-Time Embedded Systems",
    department: "Dept. of Electrical & Computer Engineering",
    institution: "Carnegie Mellon University",
    instructorId: "faculty_david_miller",
    instructorName: "Prof. David Miller (Embedded Systems Lab)",
    description: "Hands-on low-level firmware debugging: race conditions, ISRs, UART ring buffers, and ARM Cortex memory alignment.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 28,
    assignmentsCount: 4,
    isDemo: true,
    assignments: [
      {
        assignmentId: "asg-ring-buffer",
        title: "Lab 1: UART Ring Buffer Wrap-Around Triage",
        challengeId: "embedded-ring-buffer",
        dueDate: "Due Friday, 11:59 PM",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-05T10:00:00.000Z",
      },
      {
        assignmentId: "asg-gpio-debounce",
        title: "Lab 2: Switch Contact Debounce State Machine",
        challengeId: "embedded-gpio-debounce",
        dueDate: "Due Next Wednesday",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Easy",
        points: 75,
        createdAt: "2026-09-12T10:00:00.000Z",
      },
      {
        assignmentId: "asg-spi-endian",
        title: "Lab 3: SPI 16-Bit Byte Swapping & Endianness",
        challengeId: "embedded-spi-endianness",
        dueDate: "Due in 2 Weeks",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-19T10:00:00.000Z",
      },
      {
        assignmentId: "asg-interrupt-race",
        title: "Lab 4: ISR Volatile Timestamp Race Condition",
        challengeId: "embedded-interrupt-race",
        dueDate: "Final Lab (Exam Prep)",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Hard",
        points: 150,
        createdAt: "2026-09-26T10:00:00.000Z",
      },
    ],
    students: [
      {
        userId: "student_alex",
        username: "Alex Chen (ECE '26)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=alexchen",
        elo: 1345,
        enrolledAt: "2026-09-02T10:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 4,
      },
      {
        userId: "student_priya",
        username: "Priya Sharma (ECE '25)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=priyasharma",
        elo: 1320,
        enrolledAt: "2026-09-02T11:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 3,
      },
      {
        userId: "student_marcus",
        username: "Marcus Vance (ECE '26)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=marcusvance",
        elo: 1285,
        enrolledAt: "2026-09-03T09:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 3,
      },
      {
        userId: "student_liam",
        username: "Liam Kowalski (ECE '27)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=liamk",
        elo: 1215,
        enrolledAt: "2026-09-04T14:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 2,
      },
    ],
  },
  {
    code: "CS-210-SYSTEMS",
    title: "CS-210: Systems Programming & Architecture",
    department: "Dept. of Computer Science",
    institution: "UC Berkeley",
    instructorId: "faculty_sarah_jenkins",
    instructorName: "Prof. Sarah Jenkins",
    description: "Production SWE incident response: rate limiting algorithms, token buckets, memory management, and caching concurrency.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 34,
    assignmentsCount: 3,
    isDemo: true,
    assignments: [
      {
        assignmentId: "asg-token-bucket",
        title: "Lab 1: Rate Limiter Token Leaky Bucket Fix",
        challengeId: "rate-limiter-token-bucket",
        dueDate: "Due Tomorrow",
        track: "PRODUCTION_SWE",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-05T10:00:00.000Z",
      },
      {
        assignmentId: "asg-jwt-auth",
        title: "Lab 2: JWT Expiration & Replay Attack Defense",
        challengeId: "jwt-auth-expiration",
        dueDate: "Due Next Week",
        track: "PRODUCTION_SWE",
        difficulty: "Easy",
        points: 75,
        createdAt: "2026-09-12T10:00:00.000Z",
      },
      {
        assignmentId: "asg-lru-cache",
        title: "Lab 3: O(1) Cache Eviction Pointer Unlink",
        challengeId: "lru-cache-eviction",
        dueDate: "Due in 2 Weeks",
        track: "PRODUCTION_SWE",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-19T10:00:00.000Z",
      },
    ],
    students: [
      {
        userId: "student_jordan",
        username: "Jordan Hayes (CS '26)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=jordanh",
        elo: 1390,
        enrolledAt: "2026-09-02T10:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 3,
      },
      {
        userId: "student_emily",
        username: "Emily Wong (CS '25)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=emilyw",
        elo: 1310,
        enrolledAt: "2026-09-03T11:00:00.000Z",
        role: "STUDENT",
        completedAssignmentsCount: 2,
      },
    ],
  },
];

// ── Database Accessors ────────────────────────────────────────────────────────

export async function getCohortsForUser(userId: string) {
  const userCohorts: Cohort[] = [];

  try {
    // 1. Fetch user enrollment records
    const enrollRes = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": "ENROLLED#",
        },
      })
    );

    const enrolledCodes = (enrollRes.Items || []).map((it) => it.code);

    // 2. Fetch created cohorts by user
    const scanRes = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(PK, :cohortPrefix) AND SK = :meta",
        ExpressionAttributeValues: {
          ":cohortPrefix": "COHORT#",
          ":meta": "METADATA",
        },
      })
    );

    const allDbCohorts = scanRes.Items || [];

    for (const c of allDbCohorts) {
      if (c.instructorId === userId || enrolledCodes.includes(c.code)) {
        userCohorts.push({
          code: c.code,
          title: c.title,
          department: c.department,
          institution: c.institution,
          instructorId: c.instructorId,
          instructorName: c.instructorName,
          description: c.description,
          createdAt: c.createdAt,
          studentCount: Number(c.studentCount || 0),
          assignmentsCount: Number(c.assignmentsCount || 0),
        });
      }
    }
  } catch (err) {
    console.error("Failed to query cohorts from database:", err);
  }

  // Combine with default seeded cohorts if not already present
  const combined = [...userCohorts];
  for (const demo of SEEDED_COHORTS) {
    if (!combined.some((c) => c.code === demo.code)) {
      combined.push({
        code: demo.code,
        title: demo.title,
        department: demo.department,
        institution: demo.institution,
        instructorId: demo.instructorId,
        instructorName: demo.instructorName,
        description: demo.description,
        createdAt: demo.createdAt,
        studentCount: demo.studentCount,
        assignmentsCount: demo.assignmentsCount,
        isDemo: true,
      });
    }
  }

  return combined;
}

export async function getCohortByCode(code: string, currentUserId?: string) {
  const cleanCode = code.toUpperCase().trim();

  // 1. Check seeded demo cohorts
  const demoCohort = SEEDED_COHORTS.find((c) => c.code === cleanCode);

  // 2. Fetch database cohort metadata
  let dbMeta: any = null;
  try {
    const metaRes = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `COHORT#${cleanCode}`, SK: "METADATA" },
      })
    );
    dbMeta = metaRes.Item || null;
  } catch (err) {
    console.error("Failed to get cohort metadata:", err);
  }

  if (!dbMeta && !demoCohort) {
    return null;
  }

  const baseCohort: Cohort = dbMeta
    ? {
        code: dbMeta.code,
        title: dbMeta.title,
        department: dbMeta.department,
        institution: dbMeta.institution,
        instructorId: dbMeta.instructorId,
        instructorName: dbMeta.instructorName,
        description: dbMeta.description,
        createdAt: dbMeta.createdAt,
        studentCount: Number(dbMeta.studentCount || 0),
        assignmentsCount: Number(dbMeta.assignmentsCount || 0),
      }
    : {
        code: demoCohort!.code,
        title: demoCohort!.title,
        department: demoCohort!.department,
        institution: demoCohort!.institution,
        instructorId: demoCohort!.instructorId,
        instructorName: demoCohort!.instructorName,
        description: demoCohort!.description,
        createdAt: demoCohort!.createdAt,
        studentCount: demoCohort!.studentCount,
        assignmentsCount: demoCohort!.assignmentsCount,
        isDemo: true,
      };

  // Fetch assignments
  let assignments: CohortAssignment[] = [];
  try {
    const asgRes = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `COHORT#${cleanCode}`,
          ":skPrefix": "ASSIGNMENT#",
        },
      })
    );
    if (asgRes.Items && asgRes.Items.length > 0) {
      assignments = asgRes.Items.map((a) => ({
        assignmentId: a.assignmentId,
        title: a.title,
        challengeId: a.challengeId,
        dueDate: a.dueDate,
        track: a.track,
        difficulty: a.difficulty,
        points: Number(a.points || 100),
        createdAt: a.createdAt,
      }));
    }
  } catch (err) {
    console.error("Failed to get assignments:", err);
  }

  if (assignments.length === 0 && demoCohort) {
    assignments = demoCohort.assignments;
  }

  // Fetch students
  let students: CohortStudent[] = [];
  try {
    const stuRes = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `COHORT#${cleanCode}`,
          ":skPrefix": "STUDENT#",
        },
      })
    );
    if (stuRes.Items && stuRes.Items.length > 0) {
      students = stuRes.Items.map((s) => ({
        userId: s.userId,
        username: s.username,
        avatar: s.avatar ?? null,
        elo: Number(s.elo || 1200),
        enrolledAt: s.enrolledAt,
        role: s.role || "STUDENT",
        completedAssignmentsCount: Number(s.completedAssignmentsCount || 0),
      }));
    }
  } catch (err) {
    console.error("Failed to get students:", err);
  }

  if (students.length === 0 && demoCohort) {
    students = demoCohort.students;
  }

  // Fetch current user's submissions
  let userSubmissions: Record<string, boolean> = {};
  if (currentUserId) {
    try {
      const subRes = await dynamo.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `COHORT#${cleanCode}`,
            ":skPrefix": `SUBMISSION#`,
          },
        })
      );
      if (subRes.Items) {
        for (const item of subRes.Items) {
          if (item.userId === currentUserId && item.status === "PASSED") {
            userSubmissions[item.assignmentId] = true;
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch user submissions:", err);
    }
  }

  return {
    ...baseCohort,
    assignments,
    students: students.sort((a, b) => b.elo - a.elo),
    userSubmissions,
  };
}

export async function createCohort(params: {
  code: string;
  title: string;
  department: string;
  institution: string;
  instructorId: string;
  instructorName: string;
  description: string;
}) {
  const code = params.code.toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");
  const now = new Date().toISOString();

  const item = {
    PK: `COHORT#${code}`,
    SK: "METADATA",
    code,
    title: params.title.trim(),
    department: params.department.trim(),
    institution: params.institution.trim(),
    instructorId: params.instructorId,
    instructorName: params.instructorName,
    description: params.description.trim(),
    createdAt: now,
    studentCount: 1, // Instructor counts or starts at 0
    assignmentsCount: 0,
  };

  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));

  // Register enrollment for instructor as FACULTY
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `COHORT#${code}`,
        SK: `STUDENT#${params.instructorId}`,
        userId: params.instructorId,
        username: params.instructorName,
        avatar: null,
        elo: 1500,
        enrolledAt: now,
        role: "FACULTY",
        completedAssignmentsCount: 0,
      },
    })
  );

  // Link to instructor profile
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${params.instructorId}`,
        SK: `ENROLLED#${code}`,
        code,
        title: params.title.trim(),
        institution: params.institution.trim(),
        joinedAt: now,
      },
    })
  );

  return item;
}

export async function joinCohort(code: string, user: { id: string; name: string; avatar: string | null; elo: number }) {
  const cleanCode = code.toUpperCase().trim();
  const cohort = await getCohortByCode(cleanCode);
  if (!cohort) {
    throw new Error(`Cohort code "${cleanCode}" not found.`);
  }

  const now = new Date().toISOString();

  // Check if student already enrolled
  const existing = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `COHORT#${cleanCode}`, SK: `STUDENT#${user.id}` },
    })
  );

  if (!existing.Item) {
    // Add student to cohort roster
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `COHORT#${cleanCode}`,
          SK: `STUDENT#${user.id}`,
          userId: user.id,
          username: user.name,
          avatar: user.avatar,
          elo: user.elo || 1200,
          enrolledAt: now,
          role: "STUDENT",
          completedAssignmentsCount: 0,
        },
      })
    );

    // Link cohort to student profile
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${user.id}`,
          SK: `ENROLLED#${cleanCode}`,
          code: cleanCode,
          title: cohort.title,
          institution: cohort.institution,
          joinedAt: now,
        },
      })
    );
  }

  return cohort;
}
