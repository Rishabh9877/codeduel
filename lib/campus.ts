import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { STARTING_ELO } from "./elo";

export * from "./campus-data";
import { SEEDED_COHORTS, type Cohort, type CohortAssignment, type CohortStudent, type CohortSubmission } from "./campus-data";

// ── Database Accessors ────────────────────────────────────────────────────────

export async function getCohortsForUser(userId: string, isAdmin = false) {
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

    // 2. Fetch created cohorts
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
      if (isAdmin || c.instructorId === userId || enrolledCodes.includes(c.code)) {
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

  // Return user's cohorts, or provide seeded course cohorts so they can immediately explore and enroll
  if (userCohorts.length === 0) {
    return SEEDED_COHORTS.map((c) => ({
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
    }));
  }

  // Return user's authentic cohorts (or all cohorts for administrators)
  return userCohorts;
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
        // Only mark as demo if there's no authenticated user (guest preview)
        ...(currentUserId ? {} : { isDemo: true }),
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
        elo: Number(s.elo || STARTING_ELO),
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

  // Fetch all submissions for real analytics and gradebook
  let allSubmissions: Array<{
    userId: string;
    username: string;
    assignmentId: string;
    status: string;
    timeTakenSeconds: number;
    passedAt: string;
  }> = [];
  let userSubmissions: Record<string, boolean> = {};

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
      allSubmissions = subRes.Items.map((item) => ({
        userId: item.userId,
        username: item.username || "Student",
        assignmentId: item.assignmentId,
        status: item.status || "PASSED",
        timeTakenSeconds: Number(item.timeTakenSeconds || 0),
        passedAt: item.passedAt || "",
      }));

      for (const item of allSubmissions) {
        if (currentUserId && item.userId === currentUserId && item.status === "PASSED") {
          userSubmissions[item.assignmentId] = true;
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch cohort submissions:", err);
  }

  if (allSubmissions.length === 0 && demoCohort) {
    allSubmissions = demoCohort.students.flatMap((s, sIdx) => {
      const subs = [];
      if (s.completedAssignmentsCount >= 1 && assignments[0]) {
        subs.push({
          userId: s.userId,
          username: s.username,
          assignmentId: assignments[0].assignmentId,
          status: "PASSED",
          timeTakenSeconds: 180 + ((sIdx * 17) % 110),
          passedAt: new Date(Date.now() - 3600000 * 48 + sIdx * 3600000).toISOString(),
        });
      }
      if (s.completedAssignmentsCount >= 2 && assignments[1]) {
        subs.push({
          userId: s.userId,
          username: s.username,
          assignmentId: assignments[1].assignmentId,
          status: "PASSED",
          timeTakenSeconds: 220 + ((sIdx * 23) % 130),
          passedAt: new Date(Date.now() - 3600000 * 24 + sIdx * 3600000).toISOString(),
        });
      }
      if (s.completedAssignmentsCount >= 3 && assignments[2]) {
        subs.push({
          userId: s.userId,
          username: s.username,
          assignmentId: assignments[2].assignmentId,
          status: "PASSED",
          timeTakenSeconds: 275 + ((sIdx * 19) % 140),
          passedAt: new Date(Date.now() - 3600000 * 12 + sIdx * 3600000).toISOString(),
        });
      }
      if (s.completedAssignmentsCount >= 4 && assignments[3]) {
        subs.push({
          userId: s.userId,
          username: s.username,
          assignmentId: assignments[3].assignmentId,
          status: "PASSED",
          timeTakenSeconds: 310 + ((sIdx * 29) % 160),
          passedAt: new Date(Date.now() - 3600000 * 4 + sIdx * 3600000).toISOString(),
        });
      }
      return subs;
    });

    if (!currentUserId && assignments[0]) {
      userSubmissions[assignments[0].assignmentId] = true;
    }
  }

  // Calculate real student completed assignment counts
  const completedByStudent: Record<string, number> = {};
  for (const sub of allSubmissions) {
    if (sub.status === "PASSED") {
      completedByStudent[sub.userId] = (completedByStudent[sub.userId] || 0) + 1;
    }
  }

  const updatedStudents = students.map((stu) => ({
    ...stu,
    completedAssignmentsCount: completedByStudent[stu.userId] ?? stu.completedAssignmentsCount ?? 0,
  }));

  const totalSubmissions = allSubmissions.length;
  const totalTime = allSubmissions.reduce((acc, it) => acc + it.timeTakenSeconds, 0);
  const avgTimeSeconds = totalSubmissions > 0 ? Math.round(totalTime / totalSubmissions) : 245;
  const computedPassRate = totalSubmissions > 0 && updatedStudents.length > 0 && assignments.length > 0
    ? Math.min(100, Math.round((totalSubmissions / (updatedStudents.length * assignments.length)) * 100))
    : (demoCohort ? 84 : 0);

  const stats = {
    totalStudents: updatedStudents.length,
    totalSubmissions,
    avgTimeSeconds,
    passRate: computedPassRate,
  };

  return {
    ...baseCohort,
    assignments,
    students: updatedStudents.sort((a, b) => b.elo - a.elo),
    userSubmissions,
    allSubmissions,
    stats,
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
  const cohort = await getCohortByCode(cleanCode, user.id);
  if (!cohort) {
    throw new Error(`Cohort code "${cleanCode}" not found.`);
  }

  const now = new Date().toISOString();

  // Ensure cohort metadata exists in DynamoDB so enrollment and assignments are fully operational
  try {
    const metaRes = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `COHORT#${cleanCode}`, SK: "METADATA" } })
    );
    if (!metaRes.Item) {
      const seeded = SEEDED_COHORTS.find((c) => c.code === cleanCode);
      if (seeded) {
        await dynamo.send(
          new PutCommand({
            TableName: TABLE,
            Item: {
              PK: `COHORT#${cleanCode}`,
              SK: "METADATA",
              code: seeded.code,
              title: seeded.title,
              department: seeded.department,
              institution: seeded.institution,
              instructorId: seeded.instructorId,
              instructorName: seeded.instructorName,
              description: seeded.description,
              createdAt: seeded.createdAt,
              studentCount: (seeded.studentCount || 0) + 1,
              assignmentsCount: seeded.assignmentsCount,
            },
          })
        );
      }
    }
  } catch (mErr) {
    console.warn("Could not sync cohort metadata on join:", mErr);
  }

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
          elo: user.elo || STARTING_ELO,
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
