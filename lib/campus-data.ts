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
  integrityScore?: number;
  tabSwitches?: number;
  externalPastes?: number;
  proctorStatus?: string;
}

export interface CohortSubmission {
  userId: string;
  username: string;
  assignmentId: string;
  status: string;
  timeTakenSeconds: number;
  passedAt: string;
}

export interface CohortStats {
  totalStudents: number;
  totalSubmissions: number;
  avgTimeSeconds: number;
  passRate: number;
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

// ── Default Seeded Academic Cohorts for Demos / Unauthenticated Previews ───────
export const SEEDED_COHORTS: Array<
  Cohort & {
    assignments: CohortAssignment[];
    students: CohortStudent[];
  }
> = [
  {
    code: "ECE-204-EMBEDDED",
    title: "ECE-204: Embedded Systems & Firmware Engineering",
    department: "Dept. of Electrical & Computer Engineering",
    institution: "Institute of Technology & Applied Sciences",
    instructorId: "faculty_vikram_malhotra",
    instructorName: "Dr. Vikram Malhotra (Embedded Systems Lab)",
    description: "Hands-on low-level firmware debugging: race conditions, ISRs, UART ring buffers, and ARM Cortex memory alignment.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 24,
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
      { userId: "demo_stu_1", username: "aarav_sharma", avatar: null, elo: 1340, enrolledAt: "2026-09-02T10:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 4, integrityScore: 100, tabSwitches: 0, externalPastes: 0, proctorStatus: "100% Verified (0 Pastes, 0 Tab Switches)" },
      { userId: "demo_stu_2", username: "priya_sundaram", avatar: null, elo: 1290, enrolledAt: "2026-09-02T11:15:00.000Z", role: "STUDENT", completedAssignmentsCount: 4, integrityScore: 98, tabSwitches: 0, externalPastes: 0, proctorStatus: "98% Verified (0 Pastes, 0 Tab Switches)" },
      { userId: "demo_stu_3", username: "neha_patel", avatar: null, elo: 1210, enrolledAt: "2026-09-02T12:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 3, integrityScore: 65, tabSwitches: 3, externalPastes: 1, proctorStatus: "Flagged (3 Tab Switches)" },
      { userId: "demo_stu_4", username: "kabir_mehta", avatar: null, elo: 1180, enrolledAt: "2026-09-03T09:30:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_stu_5", username: "ishaan_joshi", avatar: null, elo: 1150, enrolledAt: "2026-09-03T14:20:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_stu_6", username: "rohan_verma", avatar: null, elo: 1120, enrolledAt: "2026-09-04T08:45:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_stu_7", username: "ananya_deshmukh", avatar: null, elo: 1080, enrolledAt: "2026-09-04T16:10:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
      { userId: "demo_stu_8", username: "aditya_rao", avatar: null, elo: 1040, enrolledAt: "2026-09-05T10:30:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
    ],
  },
  {
    code: "CS-301-SYSTEMS",
    title: "CS-301: Distributed Systems & Cloud Microservices",
    department: "Dept. of Computer Science & Software Engineering",
    institution: "Institute of Technology & Applied Sciences",
    instructorId: "faculty_divya_gupta",
    instructorName: "Prof. Divya Gupta (Cloud Infrastructure Lab)",
    description: "Production SWE incident response: rate limiting algorithms, token buckets, memory management, and caching concurrency.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 32,
    assignmentsCount: 3,
    isDemo: true,
    assignments: [
      {
        assignmentId: "asg-token-bucket",
        title: "Lab 1: Rate Limiter Token Leaky Bucket Fix",
        challengeId: "swe-token-bucket",
        dueDate: "Due Tomorrow",
        track: "PRODUCTION_SWE",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-05T10:00:00.000Z",
      },
      {
        assignmentId: "asg-jwt-auth",
        title: "Lab 2: JWT Algorithm Confusion & Bypass Defense",
        challengeId: "swe-jwt-alg-confusion",
        dueDate: "Due Next Week",
        track: "PRODUCTION_SWE",
        difficulty: "Hard",
        points: 125,
        createdAt: "2026-09-12T10:00:00.000Z",
      },
      {
        assignmentId: "asg-cache-stampede",
        title: "Lab 3: Cache Stampede SingleFlight Mutex Lock",
        challengeId: "swe-cache-stampede",
        dueDate: "Due in 2 Weeks",
        track: "PRODUCTION_SWE",
        difficulty: "Hard",
        points: 150,
        createdAt: "2026-09-19T10:00:00.000Z",
      },
    ],
    students: [
      { userId: "demo_cs_1", username: "tanya_khanna", avatar: null, elo: 1360, enrolledAt: "2026-09-02T10:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_cs_2", username: "divya_menon", avatar: null, elo: 1290, enrolledAt: "2026-09-02T11:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_cs_3", username: "vikas_nair", avatar: null, elo: 1230, enrolledAt: "2026-09-03T13:40:00.000Z", role: "STUDENT", completedAssignmentsCount: 3 },
      { userId: "demo_cs_4", username: "siddharth_sen", avatar: null, elo: 1170, enrolledAt: "2026-09-04T09:15:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
      { userId: "demo_cs_5", username: "sneha_kulkarni", avatar: null, elo: 1120, enrolledAt: "2026-09-04T15:30:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
      { userId: "demo_cs_6", username: "manish_pandey", avatar: null, elo: 1080, enrolledAt: "2026-09-05T11:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
    ],
  },
  {
    code: "CS-402-DISTRIBUTED",
    title: "CS-402: Distributed Consensus & Fault Tolerance",
    department: "Dept. of Computer Science & Software Engineering",
    institution: "Institute of Technology & Applied Sciences",
    instructorId: "faculty_arun_sharma",
    instructorName: "Dr. Arun Sharma (Distributed Systems)",
    description: "Hands-on debugging of network partitions, distributed retries with jitter, and event loop starvation.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 18,
    assignmentsCount: 2,
    isDemo: true,
    assignments: [
      {
        assignmentId: "asg-retry-backoff",
        title: "Lab 1: Truncated Exponential Backoff with Decorrelated Jitter",
        challengeId: "swe-retry-backoff",
        dueDate: "Due in 3 Days",
        track: "PRODUCTION_SWE",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-08T10:00:00.000Z",
      },
      {
        assignmentId: "asg-async-worker",
        title: "Lab 2: Worker Pool Promise Leak & Unhandled Rejection Triage",
        challengeId: "swe-async-worker-leak",
        dueDate: "Due Next Friday",
        track: "PRODUCTION_SWE",
        difficulty: "Hard",
        points: 125,
        createdAt: "2026-09-15T10:00:00.000Z",
      },
    ],
    students: [
      { userId: "demo_cs4_1", username: "kavya_nambiar", avatar: null, elo: 1420, enrolledAt: "2026-09-03T10:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
      { userId: "demo_cs4_2", username: "tarun_bose", avatar: null, elo: 1380, enrolledAt: "2026-09-03T12:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
    ],
  },
  {
    code: "ECE-310-RTOS",
    title: "ECE-310: Real-Time Operating Systems & Architecture",
    department: "Dept. of Electrical & Computer Engineering",
    institution: "Institute of Technology & Applied Sciences",
    instructorId: "faculty_kiran_rao",
    instructorName: "Prof. Kiran Rao (Firmware & Silicon Lab)",
    description: "Real-time task scheduling, PWM prescaler clock alignment, and memory alignment hazards.",
    createdAt: "2026-09-01T08:00:00.000Z",
    studentCount: 20,
    assignmentsCount: 2,
    isDemo: true,
    assignments: [
      {
        assignmentId: "asg-pwm-prescaler",
        title: "Lab 1: Timer Hardware Prescaler Frequency Alignment",
        challengeId: "embedded-pwm-prescaler",
        dueDate: "Due in 1 Week",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Medium",
        points: 100,
        createdAt: "2026-09-10T10:00:00.000Z",
      },
      {
        assignmentId: "asg-packed-align",
        title: "Lab 2: Struct Byte Padding & Unaligned Memory Fault Triage",
        challengeId: "embedded-packed-alignment",
        dueDate: "Due in 2 Weeks",
        track: "EMBEDDED_SYSTEMS",
        difficulty: "Hard",
        points: 150,
        createdAt: "2026-09-17T10:00:00.000Z",
      },
    ],
    students: [
      { userId: "demo_rtos_1", username: "rahul_saxena", avatar: null, elo: 1310, enrolledAt: "2026-09-03T09:00:00.000Z", role: "STUDENT", completedAssignmentsCount: 2 },
      { userId: "demo_rtos_2", username: "meera_krishnan", avatar: null, elo: 1250, enrolledAt: "2026-09-03T11:30:00.000Z", role: "STUDENT", completedAssignmentsCount: 1 },
    ],
  },
];

export function getDemoCohorts(): Cohort[] {
  return SEEDED_COHORTS.map((demo) => ({
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
  }));
}
