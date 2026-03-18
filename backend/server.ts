import express, { Request, Response } from 'express';
import cors from 'cors';
import { evaluate, simplify } from 'mathjs';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface ChapterStats {
  attempts: number;
  correct: number;
  mistakes: Record<string, number>;
  updatedAt: string;
}

interface StudentProfile {
  id: string;
  alias?: string;
  instituteName?: string;
  classGroup?: string;
  authToken: string;
  createdAt: string;
  score?: number;
  activity?: {
    calculatorUses: number;
    solvedQuestions: number;
    coachActions: number;
    challengeAttempts: number;
  };
  hardChapterMarks?: Record<string, boolean>;
  planCompletions?: PlanCompletionRecord[];
  challenges?: Record<string, ChallengeAttempt>;
  weakness: Record<string, ChapterStats>;
}

interface PlanCompletionRecord {
  planId: string;
  targetChapterKey: string;
  completedQuestions: number;
  totalQuestions: number;
  completionRate: number;
  timeSpentMinutes?: number;
  createdAt: string;
}

interface ChallengeAttempt {
  id: string;
  className: string;
  chapter: string;
  questionCount: number;
  timeLimitSeconds: number;
  startedAt: string;
  expiresAt: string;
  status: 'active' | 'submitted' | 'expired';
  correctAnswers?: number;
  scoreAwarded?: number;
  submittedAt?: string;
  antiCheatFlags?: string[];
  antiCheatPenalty?: number;
}

interface StudentDB {
  profiles: Record<string, StudentProfile>;
}

interface UserAccount {
  id: string;
  email: string;
  provider?: 'otp' | 'google';
  googleSub?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  displayName?: string;
  studentId?: string;
  createdAt: string;
  lastLoginAt: string;
}

interface UsersDB {
  users: Record<string, UserAccount>;
}

interface PendingOtp {
  email: string;
  code: string;
  requestedAt: string;
  expiresAt: string;
  attempts: number;
}

interface OtpDB {
  pending: Record<string, PendingOtp>;
}

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'student_profiles.json');
const usersPath = path.join(dbDir, 'users.json');
const otpPath = path.join(dbDir, 'auth_otps.json');

const isProd = process.env.NODE_ENV === 'production';
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const googleOAuthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

const ensureStudentDb = (): void => {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    const initial: StudentDB = { profiles: {} };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf-8');
  }

  if (!fs.existsSync(usersPath)) {
    const initialUsers: UsersDB = { users: {} };
    fs.writeFileSync(usersPath, JSON.stringify(initialUsers, null, 2), 'utf-8');
  }

  if (!fs.existsSync(otpPath)) {
    const initialOtp: OtpDB = { pending: {} };
    fs.writeFileSync(otpPath, JSON.stringify(initialOtp, null, 2), 'utf-8');
  }
};

const loadStudentDb = (): StudentDB => {
  ensureStudentDb();
  const raw = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(raw) as StudentDB;
};

const saveStudentDb = (db: StudentDB): void => {
  ensureStudentDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
};

const loadUsersDb = (): UsersDB => {
  ensureStudentDb();
  const raw = fs.readFileSync(usersPath, 'utf-8');
  return JSON.parse(raw) as UsersDB;
};

const saveUsersDb = (db: UsersDB): void => {
  ensureStudentDb();
  fs.writeFileSync(usersPath, JSON.stringify(db, null, 2), 'utf-8');
};

const loadOtpDb = (): OtpDB => {
  ensureStudentDb();
  const raw = fs.readFileSync(otpPath, 'utf-8');
  return JSON.parse(raw) as OtpDB;
};

const saveOtpDb = (db: OtpDB): void => {
  ensureStudentDb();
  fs.writeFileSync(otpPath, JSON.stringify(db, null, 2), 'utf-8');
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isValidEmail = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const loadCurriculumData = (): any => {
  const curriculumPath = path.join(__dirname, '..', 'aimo3', 'data', 'ncert_curriculum_9_12.json');
  const raw = fs.readFileSync(curriculumPath, 'utf-8');
  return JSON.parse(raw);
};

const getQuestionTypesForChapter = (className: string, chapterName: string): string[] => {
  try {
    const curriculum = loadCurriculumData();
    const grade = parseInt(className.replace('Class ', ''), 10);
    const cls = (curriculum.classes || []).find((item: any) => item.grade === grade);
    if (!cls) return [];
    const chapter = (cls.chapters || []).find((item: any) => item.name === chapterName);
    return chapter?.question_types || [];
  } catch {
    return [];
  }
};

const getOrCreateStudentProfile = (studentId?: string): StudentProfile => {
  const db = loadStudentDb();
  const id = studentId || `student_${crypto.randomUUID()}`;

  if (!db.profiles[id]) {
    db.profiles[id] = {
      id,
      alias: `Learner-${id.slice(-4)}`,
      instituteName: '',
      classGroup: '',
      authToken: crypto.randomBytes(24).toString('hex'),
      createdAt: new Date().toISOString(),
      score: 0,
      activity: {
        calculatorUses: 0,
        solvedQuestions: 0,
        coachActions: 0,
        challengeAttempts: 0,
      },
      hardChapterMarks: {},
      planCompletions: [],
      challenges: {},
      weakness: {},
    };
    saveStudentDb(db);
  }

  const profile = db.profiles[id];
  profile.score = typeof profile.score === 'number' ? profile.score : 0;
  profile.instituteName = profile.instituteName || '';
  profile.classGroup = profile.classGroup || '';
  profile.activity = profile.activity || {
    calculatorUses: 0,
    solvedQuestions: 0,
    coachActions: 0,
    challengeAttempts: 0,
  };
  profile.hardChapterMarks = profile.hardChapterMarks || {};
  profile.planCompletions = profile.planCompletions || [];
  profile.challenges = profile.challenges || {};
  db.profiles[id] = profile;
  saveStudentDb(db);

  return profile;
};

const ensureProfileDefaults = (profile: StudentProfile): StudentProfile => {
  profile.score = typeof profile.score === 'number' ? profile.score : 0;
  profile.instituteName = profile.instituteName || '';
  profile.classGroup = profile.classGroup || '';
  profile.activity = profile.activity || {
    calculatorUses: 0,
    solvedQuestions: 0,
    coachActions: 0,
    challengeAttempts: 0,
  };
  profile.hardChapterMarks = profile.hardChapterMarks || {};
  profile.planCompletions = profile.planCompletions || [];
  profile.challenges = profile.challenges || {};
  return profile;
};

const getDaysSince = (isoDate?: string): number => {
  if (!isoDate) return 30;
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return 30;
  const diffMs = Date.now() - ts;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
};

const getLatestPlanCompletionForChapter = (
  profile: StudentProfile,
  targetChapterKey: string
): PlanCompletionRecord | null => {
  const records = (profile.planCompletions || []).filter((r) => r.targetChapterKey === targetChapterKey);
  if (records.length === 0) return null;
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return records[0] || null;
};

const extractTokenFromRequest = (req: Request): string | null => {
  const headerToken = req.header('x-student-token');
  if (headerToken) return headerToken;

  const auth = req.header('authorization') || req.header('Authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  const bodyToken = req.body?.studentToken;
  if (typeof bodyToken === 'string' && bodyToken.trim().length > 0) {
    return bodyToken.trim();
  }

  return null;
};

const isAuthorizedForStudent = (req: Request, studentId: string): boolean => {
  const db = loadStudentDb();
  const profile = db.profiles[studentId];
  if (!profile) return false;

  const token = extractTokenFromRequest(req);
  if (!token) return false;
  return token === profile.authToken;
};

const isTokenValidForStudentId = (studentId?: string, token?: string): boolean => {
  if (!studentId || !token) return false;
  const db = loadStudentDb();
  const profile = db.profiles[studentId];
  if (!profile) return false;
  return profile.authToken === token;
};

const generateOtpCode = (): string => `${Math.floor(100000 + Math.random() * 900000)}`;

const findUserByEmail = (usersDb: UsersDB, email: string): UserAccount | undefined => {
  const normalized = normalizeEmail(email);
  return Object.values(usersDb.users).find((u) => normalizeEmail(u.email) === normalized);
};

const findUserByGoogleSub = (usersDb: UsersDB, googleSub: string): UserAccount | undefined => {
  return Object.values(usersDb.users).find((u) => u.googleSub === googleSub);
};

const issueUserSession = (user: UserAccount): UserAccount => {
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  user.sessionToken = sessionToken;
  user.sessionExpiresAt = sessionExpiresAt;
  user.lastLoginAt = new Date().toISOString();
  return user;
};

const getOrCreateUserByEmail = (email: string): UserAccount => {
  const usersDb = loadUsersDb();
  const normalized = normalizeEmail(email);
  const existing = findUserByEmail(usersDb, normalized);

  if (existing) {
    return existing;
  }

  const id = `user_${crypto.randomUUID()}`;
  const created: UserAccount = {
    id,
    email: normalized,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  usersDb.users[id] = created;
  saveUsersDb(usersDb);
  return created;
};

const computeChapterWeaknessScore = (
  key: string,
  stats: ChapterStats,
  hardMarked: boolean
): number => {
  if (stats.attempts <= 0) return 0;

  const accuracy = (stats.correct / stats.attempts) * 100;
  const accuracyPenalty = 100 - accuracy;
  const totalMistakes = Object.values(stats.mistakes || {}).reduce((sum, count) => sum + count, 0);
  const mistakePerAttempt = totalMistakes / stats.attempts;
  const mistakePenalty = Math.min(100, mistakePerAttempt * 25);

  let score = accuracyPenalty * 0.7 + mistakePenalty * 0.3;
  if (hardMarked) {
    // User self-marking gives a small nudge, but behavior still dominates.
    score += 8;
  }

  return Math.round(score * 100) / 100;
};

const computeWeaknessScores = (profile: StudentProfile): Record<string, number> => {
  const scores: Record<string, number> = {};
  const hardMarks = profile.hardChapterMarks || {};

  for (const [key, stats] of Object.entries(profile.weakness || {})) {
    scores[key] = computeChapterWeaknessScore(key, stats, !!hardMarks[key]);
  }

  return scores;
};

const chooseWeakestChapter = (profile: StudentProfile): string | null => {
  const entries = Object.entries(profile.weakness);
  if (entries.length === 0) return null;

  let weakest: string | null = null;
  let highestWeaknessScore = -1;

  for (const [key, value] of entries) {
    const score = computeChapterWeaknessScore(key, value, !!(profile.hardChapterMarks || {})[key]);
    if (score > highestWeaknessScore) {
      highestWeaknessScore = score;
      weakest = key;
    }
  }

  return weakest;
};

const dominantMistake = (stats: ChapterStats): string => {
  const entries = Object.entries(stats.mistakes || {});
  if (entries.length === 0) return 'formula-choice';

  let best = entries[0][0];
  let max = entries[0][1];
  for (const [type, count] of entries) {
    if (count > max) {
      max = count;
      best = type;
    }
  }
  return best;
};

type LeaderboardType = 'global' | 'class' | 'institute' | 'chapter-challenge';

interface LeaderboardScoreBreakdown {
  legacyScore: number;
  activityPoints: number;
  accuracyPoints: number;
  consistencyPoints: number;
  improvementPoints: number;
  weaknessRecoveryBonus: number;
  antiCheatAdjustment: number;
  finalScore: number;
}

const toDayKey = (isoDate?: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const computeDayStreak = (dayKeys: string[]): number => {
  if (dayKeys.length === 0) return 0;
  const uniqueSorted = Array.from(new Set(dayKeys)).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let cursor = new Date();

  for (const key of uniqueSorted) {
    const expected = cursor.toISOString().slice(0, 10);
    if (key === expected) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }

    if (streak === 0) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (key === yesterday) {
        streak = 1;
        cursor = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        continue;
      }
    }

    break;
  }

  return streak;
};

const computePlanCompletionGrowth = (profile: StudentProfile): number => {
  const now = Date.now();
  const recent: number[] = [];
  const previous: number[] = [];

  for (const record of profile.planCompletions || []) {
    const ts = new Date(record.createdAt).getTime();
    if (Number.isNaN(ts)) continue;
    const daysAgo = (now - ts) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 7) recent.push(record.completionRate);
    else if (daysAgo <= 14) previous.push(record.completionRate);
  }

  if (recent.length === 0 || previous.length === 0) return 0;
  const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const prevAvg = previous.reduce((sum, v) => sum + v, 0) / previous.length;
  return Math.max(0, recentAvg - prevAvg);
};

const computeWeaknessRecoveryBonus = (
  chapterEntries: Array<[string, ChapterStats]>
): number => {
  let recoveredCount = 0;
  for (const [, stats] of chapterEntries) {
    if (stats.attempts < 5) continue;
    const accuracy = stats.correct / Math.max(1, stats.attempts);
    const totalMistakes = Object.values(stats.mistakes || {}).reduce((sum, value) => sum + value, 0);
    const mistakeRate = totalMistakes / Math.max(1, stats.attempts);
    if (accuracy >= 0.75 && mistakeRate <= 0.4) {
      recoveredCount += 1;
    }
  }

  return Math.min(80, recoveredCount * 10);
};

const computeLeaderboardBreakdown = (
  profile: StudentProfile,
  chapterEntries: Array<[string, ChapterStats]>,
  challengeEntries: ChallengeAttempt[]
): { attempts: number; overallAccuracy: number; chapterMastery: Record<string, number>; breakdown: LeaderboardScoreBreakdown } => {
  let totalAttempts = 0;
  let totalCorrect = 0;
  const chapterMastery: Record<string, number> = {};

  for (const [key, stats] of chapterEntries) {
    totalAttempts += stats.attempts;
    totalCorrect += stats.correct;
    chapterMastery[key] = stats.attempts === 0 ? 0 : Math.round((stats.correct / stats.attempts) * 100);
  }

  const overallAccuracy = totalAttempts === 0 ? 0 : Math.round((totalCorrect / totalAttempts) * 100);

  const activity = profile.activity || {
    calculatorUses: 0,
    solvedQuestions: 0,
    coachActions: 0,
    challengeAttempts: 0,
  };

  const activityDayKeys = [
    ...((profile.planCompletions || []).map((item) => toDayKey(item.createdAt))),
    ...challengeEntries.map((item) => toDayKey(item.startedAt)),
    ...challengeEntries.map((item) => toDayKey(item.submittedAt)),
  ].filter((item) => !!item) as string[];

  const activityPoints = Math.round(
    activityDayKeys.length * 2 +
    activity.solvedQuestions * 1.5 +
    activity.challengeAttempts * 6 +
    activity.calculatorUses * 0.5
  );

  const qualityFromAccuracy = Math.round(overallAccuracy * 0.8);
  const challengeQuality = challengeEntries.length === 0
    ? 0
    : Math.round(
      challengeEntries.reduce((sum, ch) => {
        const ratio = (ch.correctAnswers || 0) / Math.max(1, ch.questionCount);
        return sum + ratio * 20;
      }, 0) / challengeEntries.length
    );
  const accuracyPoints = qualityFromAccuracy + challengeQuality;

  const streakDays = computeDayStreak(activityDayKeys);
  const consistencyPoints = Math.min(35, streakDays * 4);

  const completionGrowth = computePlanCompletionGrowth(profile);
  const chapterGrowthProxy = Math.max(0, (overallAccuracy - 55) / 100);
  const improvementPoints = Math.round(Math.min(60, completionGrowth * 100 * 0.45 + chapterGrowthProxy * 30));

  const weaknessRecoveryBonus = computeWeaknessRecoveryBonus(chapterEntries);

  const antiCheatFlagsCount = challengeEntries.reduce(
    (sum, item) => sum + ((item.antiCheatFlags || []).length > 0 ? 1 : 0),
    0
  );
  const antiCheatAdjustment = -Math.min(120, antiCheatFlagsCount * 15);

  const legacyScore = profile.score || 0;
  const finalScore = Math.max(
    0,
    Math.round(legacyScore * 0.35 + activityPoints + accuracyPoints + consistencyPoints + improvementPoints + weaknessRecoveryBonus + antiCheatAdjustment)
  );

  return {
    attempts: totalAttempts,
    overallAccuracy,
    chapterMastery,
    breakdown: {
      legacyScore,
      activityPoints,
      accuracyPoints,
      consistencyPoints,
      improvementPoints,
      weaknessRecoveryBonus,
      antiCheatAdjustment,
      finalScore,
    },
  };
};

const toCsvValue = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  if (/[",\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const head = headers.map(toCsvValue).join(',');
  const body = rows
    .map((row) => headers.map((header) => toCsvValue(row[header])).join(','))
    .join('\n');
  return [head, body].filter((line) => line.length > 0).join('\n');
};

type SolveTier = 'tier1' | 'tier2' | 'tier3';

const detectSolveTier = (question: string): SolveTier => {
  const text = (question || '').trim().toLowerCase();

  const tier3Keywords = [
    'jee',
    'olympiad',
    'proof',
    'prove',
    'non-routine',
    'number theory',
    'combinatorics',
    'inequality',
    'advanced',
    'multi-step',
  ];

  const tier2Keywords = [
    'class 9',
    'class 10',
    'class 11',
    'class 12',
    'ncert',
    'board',
    'chapter',
    'application',
    'conceptual',
  ];

  if (tier3Keywords.some((key) => text.includes(key))) {
    return 'tier3';
  }

  if (tier2Keywords.some((key) => text.includes(key))) {
    return 'tier2';
  }

  const simpleMathPattern = /^[0-9a-zx+\-*/^().,%\s=]+$/i;
  const hasMostlyMathTokens = simpleMathPattern.test(text);
  if (hasMostlyMathTokens && text.length <= 80) {
    return 'tier1';
  }

  return 'tier2';
};

const getEstimatedSolveDepth = (tier: SolveTier): string => {
  if (tier === 'tier1') return 'Low depth (direct operations)';
  if (tier === 'tier2') return 'Medium depth (concept + application)';
  return 'High depth (advanced multi-step reasoning)';
};

const runAimo3Solve = async (
  problem: string,
  numSamples: number,
  timeBudget: number
): Promise<{ answer: number | string; solution: string; confidence: number }> => {
  return await new Promise((resolve, reject) => {
    try {
      const pythonScript = path.join(__dirname, '..', 'aimo3', 'api', 'solve.py');

      const pythonProcess = spawn('python', [
        pythonScript,
        '--problem', problem,
        '--num_samples', numSamples.toString(),
        '--time_budget', timeBudget.toString(),
      ]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(output);
            resolve({
              answer: parsed.answer,
              solution: parsed.solution || output,
              confidence: parsed.confidence ?? 0.6,
            });
          } catch {
            const raw = output.trim();
            resolve({
              answer: Number.isNaN(parseFloat(raw)) ? raw : parseFloat(raw),
              solution: raw,
              confidence: 0.5,
            });
          }
        } else {
          reject(new Error(errorOutput || 'AIMO3 solver failed'));
        }
      });
    } catch (error: any) {
      reject(error);
    }
  });
};

const solveTier1Fast = (question: string): { answer: string | number; solution: string; confidence: number } => {
  const expr = question.trim();

  try {
    const result = evaluate(expr);
    return {
      answer: typeof result === 'number' ? result : String(result),
      solution: `Direct evaluation of expression: ${expr}`,
      confidence: 0.98,
    };
  } catch {
    const simplified = simplify(expr).toString();
    return {
      answer: simplified,
      solution: `Algebraic simplification of expression: ${expr}`,
      confidence: 0.9,
    };
  }
};

app.get('/', (req: Request, res: Response) => {
  res.send('Nexus Math Weaver Backend is running!');
});

// Basic calculator endpoint
app.post('/calculate', (req: Request, res: Response) => {
  const { expression } = req.body;

  if (!expression) {
    return res.status(400).json({ error: 'Expression is required' });
  }

  try {
    const result = evaluate(expression);
    res.json({ result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// AIMO3 Competition Solver Endpoint
app.post('/api/aimo3/solve', async (req: Request, res: Response) => {
  const { problem, num_samples = 4, time_budget = 120 } = req.body;

  if (!problem) {
    return res.status(400).json({ error: 'Problem is required' });
  }

  try {
    const result = await runAimo3Solve(problem, num_samples, time_budget);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/solve/auto', async (req: Request, res: Response) => {
  const { question, num_samples = 4 } = req.body || {};

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  const normalized = question.trim();
  const tier = detectSolveTier(normalized);
  const estimatedSolveDepth = getEstimatedSolveDepth(tier);

  try {
    if (tier === 'tier1') {
      const fast = solveTier1Fast(normalized);
      return res.json({
        tier,
        route: 'calculator-engine',
        estimatedSolveDepth,
        ...fast,
      });
    }

    const timeBudget = tier === 'tier3' ? 240 : 140;
    const ai = await runAimo3Solve(normalized, Number(num_samples) || 4, timeBudget);
    return res.json({
      tier,
      route: 'ai-solver-pipeline',
      estimatedSolveDepth,
      ...ai,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Auto solver failed',
      details: error.message,
      tier,
      estimatedSolveDepth,
    });
  }
});

app.get('/api/aimo3/status', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    model: 'AIMO3 Math Solver',
    version: '1.0.0',
    capabilities: [
      'chain-of-thought',
      'multi-sample-reasoning',
      'majority-voting',
      'solution-verification'
    ]
  });
});

app.get('/api/aimo3/models', (req: Request, res: Response) => {
  res.json({
    models: [
      {
        id: 'qwen-math-7b',
        name: 'Qwen2.5-Math-7B-Instruct',
        description: 'Fast, good for testing',
        vram: '8GB'
      },
      {
        id: 'qwen-math-72b',
        name: 'Qwen2.5-Math-72B-Instruct',
        description: 'Best performance, requires high VRAM',
        vram: '48GB'
      },
      {
        id: 'deepseek-math',
        name: 'DeepSeek-Math-7B-Instruct',
        description: 'Math-specialized model',
        vram: '8GB'
      }
    ]
  });
});

app.get('/api/auth/config', (req: Request, res: Response) => {
  const googleConfigured = !!googleClientId && !!googleOAuthClient;

  res.json({
    google: {
      enabled: googleConfigured,
      providerReady: !!googleOAuthClient,
      clientIdConfigured: !!googleClientId,
      message: googleConfigured
        ? 'Google OAuth is enabled.'
        : 'Google OAuth is disabled. Set GOOGLE_CLIENT_ID on backend and VITE_GOOGLE_CLIENT_ID on frontend.',
    },
  });
});

app.get('/api/curriculum/ncert', (req: Request, res: Response) => {
  try {
    const data = loadCurriculumData();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      error: 'Could not load NCERT curriculum',
      details: error.message,
    });
  }
});

app.post('/api/auth/request-otp', (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalized = normalizeEmail(email);
    const otpDb = loadOtpDb();
    const code = generateOtpCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    otpDb.pending[normalized] = {
      email: normalized,
      code,
      requestedAt: now.toISOString(),
      expiresAt,
      attempts: 0,
    };
    saveOtpDb(otpDb);

    res.json({
      email: normalized,
      expiresAt,
      message: 'OTP generated. Integrate email provider to deliver OTP in production.',
      ...(isProd ? {} : { devOtp: code }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  try {
    const { email, otp, guestStudentId, guestToken } = req.body || {};

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ error: 'OTP is required' });
    }

    const normalized = normalizeEmail(email);
    const otpDb = loadOtpDb();
    const pending = otpDb.pending[normalized];

    if (!pending) {
      return res.status(400).json({ error: 'No OTP request found for this email' });
    }

    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      delete otpDb.pending[normalized];
      saveOtpDb(otpDb);
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }

    if (pending.code !== otp.trim()) {
      pending.attempts += 1;
      if (pending.attempts >= 5) {
        delete otpDb.pending[normalized];
      } else {
        otpDb.pending[normalized] = pending;
      }
      saveOtpDb(otpDb);
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    delete otpDb.pending[normalized];
    saveOtpDb(otpDb);

    const user = getOrCreateUserByEmail(normalized);
    const usersDb = loadUsersDb();
    const persistedUser = usersDb.users[user.id] || user;

    let studentIdToUse = persistedUser.studentId;
    const canUseGuest = isTokenValidForStudentId(
      typeof guestStudentId === 'string' ? guestStudentId : undefined,
      typeof guestToken === 'string' ? guestToken : undefined
    );

    if (!studentIdToUse && canUseGuest && typeof guestStudentId === 'string') {
      studentIdToUse = guestStudentId;
    }

    if (!studentIdToUse) {
      studentIdToUse = getOrCreateStudentProfile().id;
    }

    const profile = getOrCreateStudentProfile(studentIdToUse);

    persistedUser.provider = persistedUser.provider || 'otp';
    persistedUser.studentId = profile.id;
    issueUserSession(persistedUser);
    usersDb.users[persistedUser.id] = persistedUser;
    saveUsersDb(usersDb);

    res.json({
      user: {
        id: persistedUser.id,
        email: persistedUser.email,
        studentId: persistedUser.studentId,
        createdAt: persistedUser.createdAt,
        lastLoginAt: persistedUser.lastLoginAt,
        sessionToken: persistedUser.sessionToken,
        sessionExpiresAt: persistedUser.sessionExpiresAt,
      },
      student: {
        studentId: profile.id,
        studentToken: profile.authToken,
        alias: profile.alias,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    if (!googleOAuthClient || !googleClientId) {
      return res.status(503).json({ error: 'Google OAuth is not configured on server' });
    }

    const { idToken, guestStudentId, guestToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google email is not verified' });
    }

    const normalizedEmail = normalizeEmail(payload.email);
    const usersDb = loadUsersDb();
    let user = findUserByGoogleSub(usersDb, payload.sub) || findUserByEmail(usersDb, normalizedEmail);

    if (!user) {
      user = {
        id: `user_${crypto.randomUUID()}`,
        email: normalizedEmail,
        provider: 'google',
        googleSub: payload.sub,
        displayName: typeof payload.name === 'string' ? payload.name : undefined,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }

    user.email = normalizedEmail;
    user.provider = 'google';
    user.googleSub = payload.sub;
    user.displayName = typeof payload.name === 'string' ? payload.name : user.displayName;

    let studentIdToUse = user.studentId;
    const canUseGuest = isTokenValidForStudentId(
      typeof guestStudentId === 'string' ? guestStudentId : undefined,
      typeof guestToken === 'string' ? guestToken : undefined
    );

    if (!studentIdToUse && canUseGuest && typeof guestStudentId === 'string') {
      studentIdToUse = guestStudentId;
    }

    if (!studentIdToUse) {
      studentIdToUse = getOrCreateStudentProfile().id;
    }

    const profile = getOrCreateStudentProfile(studentIdToUse);

    user.studentId = profile.id;
    issueUserSession(user);
    usersDb.users[user.id] = user;
    saveUsersDb(usersDb);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        studentId: user.studentId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        sessionToken: user.sessionToken,
        sessionExpiresAt: user.sessionExpiresAt,
      },
      student: {
        studentId: profile.id,
        studentToken: profile.authToken,
        alias: profile.alias,
      },
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Google authentication failed' });
  }
});

app.post('/api/auth/restore', (req: Request, res: Response) => {
  try {
    const { userId, sessionToken } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(401).json({ error: 'sessionToken is required for restore' });
    }

    const usersDb = loadUsersDb();
    const user = usersDb.users[userId];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.sessionToken || user.sessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session token' });
    }
    if (!user.sessionExpiresAt || new Date(user.sessionExpiresAt).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    const studentId = user.studentId || getOrCreateStudentProfile().id;
    const profile = getOrCreateStudentProfile(studentId);

    user.studentId = profile.id;
    issueUserSession(user);
    usersDb.users[userId] = user;
    saveUsersDb(usersDb);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        studentId: user.studentId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        sessionToken: user.sessionToken,
        sessionExpiresAt: user.sessionExpiresAt,
      },
      student: {
        studentId: profile.id,
        studentToken: profile.authToken,
        alias: profile.alias,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', (req: Request, res: Response) => {
  try {
    const { studentId } = req.body || {};

    if (studentId) {
      const db = loadStudentDb();
      const existing = db.profiles[studentId];
      if (existing && !isAuthorizedForStudent(req, studentId)) {
        return res.status(401).json({ error: 'Invalid token for existing student profile' });
      }
    }

    const profile = getOrCreateStudentProfile(studentId);
    res.json({
      studentId: profile.id,
      alias: profile.alias,
      studentToken: profile.authToken,
      createdAt: profile.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/alias', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const { alias, instituteName, classGroup } = req.body || {};

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    if (!alias || typeof alias !== 'string' || !alias.trim()) {
      return res.status(400).json({ error: 'alias is required' });
    }

    const db = loadStudentDb();
    const existing = db.profiles[studentId] || {
      id: studentId,
      alias: `Learner-${studentId.slice(-4)}`,
      instituteName: '',
      classGroup: '',
      authToken: crypto.randomBytes(24).toString('hex'),
      createdAt: new Date().toISOString(),
      weakness: {},
    };

    existing.alias = alias.trim();
    if (typeof instituteName === 'string') {
      existing.instituteName = instituteName.trim();
    }
    if (typeof classGroup === 'string') {
      existing.classGroup = classGroup.trim();
    }
    db.profiles[studentId] = existing;
    saveStudentDb(db);

    res.json({
      studentId,
      alias: existing.alias,
      instituteName: existing.instituteName || '',
      classGroup: existing.classGroup || '',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:studentId/weakness', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const profile = getOrCreateStudentProfile(studentId);
    const weakest = chooseWeakestChapter(profile);
    const weaknessScores = computeWeaknessScores(profile);

    res.json({
      studentId: profile.id,
      alias: profile.alias,
      score: profile.score || 0,
      activity: profile.activity,
      hardChapterMarks: profile.hardChapterMarks || {},
      weakness: profile.weakness,
      weaknessScores,
      weakestChapterKey: weakest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:studentId/profile/history', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const profile = ensureProfileDefaults(getOrCreateStudentProfile(studentId));
    const challenges = Object.values(profile.challenges || {})
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 15);

    const planCompletions = (profile.planCompletions || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const totalAttempts = Object.values(profile.weakness || {}).reduce((sum, stats) => sum + stats.attempts, 0);
    const totalCorrect = Object.values(profile.weakness || {}).reduce((sum, stats) => sum + stats.correct, 0);
    const accuracy = totalAttempts === 0 ? 0 : Math.round((totalCorrect / totalAttempts) * 100);

    res.json({
      studentId: profile.id,
      alias: profile.alias,
      instituteName: profile.instituteName || '',
      classGroup: profile.classGroup || '',
      score: profile.score || 0,
      activity: profile.activity,
      summary: {
        totalAttempts,
        totalCorrect,
        accuracy,
        planCompletionCount: (profile.planCompletions || []).length,
        challengeCount: Object.keys(profile.challenges || {}).length,
      },
      planCompletions,
      recentChallenges: challenges,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/weakness/update', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const {
      className,
      chapter,
      isCorrect = false,
      mistakeType = 'formula-choice',
    } = req.body || {};

    if (!className || !chapter) {
      return res.status(400).json({ error: 'className and chapter are required' });
    }

    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || {
      id: studentId,
      alias: `Learner-${studentId.slice(-4)}`,
      authToken: crypto.randomBytes(24).toString('hex'),
      createdAt: new Date().toISOString(),
      score: 0,
      activity: {
        calculatorUses: 0,
        solvedQuestions: 0,
        coachActions: 0,
        challengeAttempts: 0,
      },
      challenges: {},
      weakness: {},
    });

    const key = `${className}::${chapter}`;
    const current = profile.weakness[key] || {
      attempts: 0,
      correct: 0,
      mistakes: {},
      updatedAt: new Date().toISOString(),
    };

    current.attempts += 1;
    current.correct += isCorrect ? 1 : 0;
    if (!isCorrect) {
      current.mistakes[mistakeType] = (current.mistakes[mistakeType] || 0) + 1;
    }
    current.updatedAt = new Date().toISOString();

    profile.weakness[key] = current;
    const profileActivity = profile.activity || {
      calculatorUses: 0,
      solvedQuestions: 0,
      coachActions: 0,
      challengeAttempts: 0,
    };
    profileActivity.coachActions += 1;
    profile.activity = profileActivity;
    db.profiles[studentId] = profile;
    saveStudentDb(db);

    const weaknessScore = computeChapterWeaknessScore(
      key,
      current,
      !!(profile.hardChapterMarks || {})[key]
    );

    const accuracy = current.attempts === 0 ? 0 : Math.round((current.correct / current.attempts) * 100);
    res.json({
      studentId,
      alias: profile.alias,
      score: profile.score || 0,
      chapterKey: key,
      chapterStats: current,
      chapterWeaknessScore: weaknessScore,
      chapterAccuracy: accuracy,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/chapters/mark-hard', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const { className, chapter, hard = true } = req.body || {};
    if (!className || !chapter) {
      return res.status(400).json({ error: 'className and chapter are required' });
    }

    const key = `${className}::${chapter}`;
    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || getOrCreateStudentProfile(studentId));

    profile.hardChapterMarks = profile.hardChapterMarks || {};
    profile.hardChapterMarks[key] = !!hard;

    db.profiles[studentId] = profile;
    saveStudentDb(db);

    res.json({
      studentId,
      chapterKey: key,
      hardMarked: !!profile.hardChapterMarks[key],
      message: 'Hard chapter mark saved. Behavior engine remains primary.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:studentId/practice/daily', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const limit = parseInt((req.query.limit as string) || '5', 10);
    const className = (req.query.className as string) || '';
    const chapter = (req.query.chapter as string) || '';

    const profile = getOrCreateStudentProfile(studentId);
    const weakness = profile.weakness;

    let targetKey = chapter && className ? `${className}::${chapter}` : chooseWeakestChapter(profile);
    if (!targetKey) {
      targetKey = chapter && className ? `${className}::${chapter}` : null;
    }

    if (!targetKey) {
      return res.json({
        studentId,
        targetChapterKey: null,
        recommendation: 'Start with an easy chapter and attempt at least 3 questions.',
        practiceSet: [
          'Easy: Recall 5 formulas from your current chapter.',
          'Medium: Solve 3 direct application questions.',
          'Hard: Solve 1 proof/reasoning question.'
        ],
      });
    }

    const stats = weakness[targetKey] || {
      attempts: 0,
      correct: 0,
      mistakes: {},
      updatedAt: new Date().toISOString(),
    };

    const topMistake = dominantMistake(stats);
    const chapterName = targetKey.split('::')[1] || 'selected chapter';
    const practiceBase = [
      `Easy: 3 formula recall questions from ${chapterName}.`,
      `Medium: 3 application questions targeting ${topMistake}.`,
      `Hard: 2 mixed reasoning questions in ${chapterName}.`,
      `Review: Write 3 common mistakes and corrections for ${chapterName}.`,
      `Challenge: 1 timed problem with full step explanation.`
    ];

    res.json({
      studentId,
      targetChapterKey: targetKey,
      topMistake,
      recommendation: `Focus today on ${chapterName}. Highest risk pattern: ${topMistake}.`,
      practiceSet: practiceBase.slice(0, Math.max(1, Math.min(limit, practiceBase.length))),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/leaderboard', (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const boardTypeRaw = ((req.query.boardType as string) || 'global').toLowerCase();
    const boardType: LeaderboardType = (
      boardTypeRaw === 'class' || boardTypeRaw === 'institute' || boardTypeRaw === 'chapter-challenge'
    )
      ? (boardTypeRaw as LeaderboardType)
      : 'global';
    const className = (req.query.className as string) || '';
    const chapter = (req.query.chapter as string) || '';
    const instituteName = (req.query.instituteName as string) || '';
    const chapterKeyFilter = className && chapter ? `${className}::${chapter}` : '';

    if (boardType === 'class' && !className) {
      return res.status(400).json({ error: 'className is required for class leaderboard' });
    }
    if (boardType === 'institute' && !instituteName) {
      return res.status(400).json({ error: 'instituteName is required for institute leaderboard' });
    }
    if (boardType === 'chapter-challenge' && !chapterKeyFilter) {
      return res.status(400).json({ error: 'className and chapter are required for chapter challenge leaderboard' });
    }

    const db = loadStudentDb();
    const rows = Object.values(db.profiles).map((profile) => {
      const normalized = ensureProfileDefaults(profile);
      const entries = Object.entries(normalized.weakness || {});
      const allChallenges = Object.values(normalized.challenges || {});

      if (boardType === 'institute' && normalizeEmail(normalized.instituteName || '') !== normalizeEmail(instituteName)) {
        return null;
      }

      if (boardType === 'class' && !entries.some(([key]) => key.startsWith(`${className}::`))) {
        return null;
      }

      const chapterEntries = entries.filter(([key]) => {
        if (boardType === 'chapter-challenge') return key === chapterKeyFilter;
        if (boardType === 'class') return key.startsWith(`${className}::`);
        return chapterKeyFilter ? key === chapterKeyFilter : true;
      });

      const challengeEntries = allChallenges.filter((ch) => {
        if (boardType === 'chapter-challenge') {
          return ch.className === className && ch.chapter === chapter && ch.status === 'submitted';
        }
        if (boardType === 'class') {
          return ch.className === className;
        }
        if (chapterKeyFilter) {
          return ch.className === className && ch.chapter === chapter;
        }
        return true;
      });

      if (boardType === 'chapter-challenge' && challengeEntries.length === 0) {
        return null;
      }

      const computed = computeLeaderboardBreakdown(normalized, chapterEntries, challengeEntries);
      return {
        studentId: normalized.id,
        alias: normalized.alias || `Learner-${normalized.id.slice(-4)}`,
        instituteName: normalized.instituteName || '',
        classGroup: normalized.classGroup || '',
        score: computed.breakdown.finalScore,
        rawScore: normalized.score || 0,
        attempts: computed.attempts,
        overallAccuracy: computed.overallAccuracy,
        chapterMastery: computed.chapterMastery,
        scoreBreakdown: computed.breakdown,
      };
    }).filter((row) => !!row);

    rows.sort((a: any, b: any) => b.score - a.score || b.overallAccuracy - a.overallAccuracy || b.attempts - a.attempts);

    res.json({
      leaderboard: rows.slice(0, Math.max(1, Math.min(limit, 200))),
      boardType,
      instituteName: instituteName || null,
      className: className || null,
      chapterKey: chapterKeyFilter || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/institutes/:instituteName/dashboard', (req: Request, res: Response) => {
  try {
    const instituteName = decodeURIComponent(req.params.instituteName || '').trim();
    if (!instituteName) {
      return res.status(400).json({ error: 'instituteName is required' });
    }

    const db = loadStudentDb();
    const profiles = Object.values(db.profiles)
      .map((profile) => ensureProfileDefaults(profile))
      .filter((profile) => normalizeEmail(profile.instituteName || '') === normalizeEmail(instituteName));

    const studentCount = profiles.length;
    const totals = profiles.reduce(
      (acc, profile) => {
        const weaknessEntries = Object.entries(profile.weakness || {});
        const attempts = weaknessEntries.reduce((sum, [, stats]) => sum + stats.attempts, 0);
        const correct = weaknessEntries.reduce((sum, [, stats]) => sum + stats.correct, 0);
        const activeChallenges = Object.values(profile.challenges || {}).filter((item) => item.status === 'active').length;
        const planCount = (profile.planCompletions || []).length;
        acc.attempts += attempts;
        acc.correct += correct;
        acc.score += profile.score || 0;
        acc.activeChallenges += activeChallenges;
        acc.planCompletions += planCount;

        const weaknessScores = computeWeaknessScores(profile);
        for (const [key, score] of Object.entries(weaknessScores)) {
          acc.chapterRisk[key] = (acc.chapterRisk[key] || 0) + score;
        }

        return acc;
      },
      {
        attempts: 0,
        correct: 0,
        score: 0,
        activeChallenges: 0,
        planCompletions: 0,
        chapterRisk: {} as Record<string, number>,
      }
    );

    const topChapterRisks = Object.entries(totals.chapterRisk)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([chapterKey, aggregatedRisk]) => ({ chapterKey, aggregatedRisk: Math.round(aggregatedRisk * 100) / 100 }));

    const accuracy = totals.attempts === 0 ? 0 : Math.round((totals.correct / totals.attempts) * 100);

    const classDistribution = profiles.reduce((acc, profile) => {
      const label = profile.classGroup || 'unassigned';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      instituteName,
      studentCount,
      kpis: {
        averageScore: studentCount === 0 ? 0 : Math.round(totals.score / studentCount),
        accuracy,
        activeChallenges: totals.activeChallenges,
        planCompletions: totals.planCompletions,
      },
      classDistribution,
      topChapterRisks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/institutes/:instituteName/export/students.csv', (req: Request, res: Response) => {
  try {
    const instituteName = decodeURIComponent(req.params.instituteName || '').trim();
    if (!instituteName) {
      return res.status(400).json({ error: 'instituteName is required' });
    }

    const db = loadStudentDb();
    const rows = Object.values(db.profiles)
      .map((profile) => ensureProfileDefaults(profile))
      .filter((profile) => normalizeEmail(profile.instituteName || '') === normalizeEmail(instituteName))
      .map((profile) => {
        const entries = Object.entries(profile.weakness || {});
        const challenges = Object.values(profile.challenges || {});
        const computed = computeLeaderboardBreakdown(profile, entries, challenges);
        return {
          studentId: profile.id,
          alias: profile.alias || '',
          instituteName: profile.instituteName || '',
          classGroup: profile.classGroup || '',
          attempts: computed.attempts,
          overallAccuracy: computed.overallAccuracy,
          score: computed.breakdown.finalScore,
          activityPoints: computed.breakdown.activityPoints,
          accuracyPoints: computed.breakdown.accuracyPoints,
          consistencyPoints: computed.breakdown.consistencyPoints,
          improvementPoints: computed.breakdown.improvementPoints,
          weaknessRecoveryBonus: computed.breakdown.weaknessRecoveryBonus,
          antiCheatAdjustment: computed.breakdown.antiCheatAdjustment,
        };
      });

    const headers = [
      'studentId',
      'alias',
      'instituteName',
      'classGroup',
      'attempts',
      'overallAccuracy',
      'score',
      'activityPoints',
      'accuracyPoints',
      'consistencyPoints',
      'improvementPoints',
      'weaknessRecoveryBonus',
      'antiCheatAdjustment',
    ];

    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${instituteName.replace(/\s+/g, '_')}_students.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/activity/score', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const { activityType, count = 1 } = req.body || {};
    const safeCount = Math.max(1, Math.min(parseInt(String(count), 10) || 1, 100));

    const pointsByActivity: Record<string, number> = {
      calculator: 1,
      'question-solve': 5,
      'coach-use': 2,
    };

    const unitPoints = pointsByActivity[activityType];
    if (!unitPoints) {
      return res.status(400).json({ error: 'Invalid activityType' });
    }

    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || getOrCreateStudentProfile(studentId));

    const awarded = unitPoints * safeCount;
    profile.score = (profile.score || 0) + awarded;

    const profileActivity = profile.activity || {
      calculatorUses: 0,
      solvedQuestions: 0,
      coachActions: 0,
      challengeAttempts: 0,
    };

    if (activityType === 'calculator') profileActivity.calculatorUses += safeCount;
    if (activityType === 'question-solve') profileActivity.solvedQuestions += safeCount;
    if (activityType === 'coach-use') profileActivity.coachActions += safeCount;
    profile.activity = profileActivity;

    db.profiles[studentId] = profile;
    saveStudentDb(db);

    res.json({
      studentId,
      activityType,
      awarded,
      score: profile.score,
      activity: profile.activity,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/challenge/start', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const {
      className,
      chapter,
      questionCount = 10,
      timeLimitSeconds = 900,
    } = req.body || {};

    if (!className || !chapter) {
      return res.status(400).json({ error: 'className and chapter are required' });
    }

    const safeQuestionCount = Math.max(1, Math.min(parseInt(String(questionCount), 10) || 10, 25));
    const safeTimeLimit = Math.max(60, Math.min(parseInt(String(timeLimitSeconds), 10) || 900, 3600));

    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || getOrCreateStudentProfile(studentId));

    const challengeId = `ch_${crypto.randomUUID()}`;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + safeTimeLimit * 1000);

    const challenge: ChallengeAttempt = {
      id: challengeId,
      className,
      chapter,
      questionCount: safeQuestionCount,
      timeLimitSeconds: safeTimeLimit,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
    };

    const profileChallenges = profile.challenges || {};
    profileChallenges[challengeId] = challenge;
    profile.challenges = profileChallenges;

    const profileActivity = profile.activity || {
      calculatorUses: 0,
      solvedQuestions: 0,
      coachActions: 0,
      challengeAttempts: 0,
    };
    profileActivity.challengeAttempts += 1;
    profile.activity = profileActivity;

    db.profiles[studentId] = profile;
    saveStudentDb(db);

    res.json({
      studentId,
      challenge,
      message: `Timed challenge started for ${safeQuestionCount} questions.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/challenge/submit', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const { challengeId, correctAnswers, explanation } = req.body || {};
    if (!challengeId || typeof challengeId !== 'string') {
      return res.status(400).json({ error: 'challengeId is required' });
    }

    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || getOrCreateStudentProfile(studentId));
    const profileChallenges = profile.challenges || {};
    const challenge = profileChallenges[challengeId];

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (challenge.status !== 'active') {
      return res.status(400).json({ error: 'Challenge already submitted or expired' });
    }

    const now = Date.now();
    const expired = now > new Date(challenge.expiresAt).getTime();
    const startedAtTs = new Date(challenge.startedAt).getTime();
    const timeTakenSeconds = Number.isNaN(startedAtTs) ? challenge.timeLimitSeconds : Math.max(1, Math.round((now - startedAtTs) / 1000));
    const safeCorrect = Math.max(0, Math.min(parseInt(String(correctAnswers), 10) || 0, challenge.questionCount));

    challenge.correctAnswers = safeCorrect;
    challenge.submittedAt = new Date().toISOString();
    challenge.status = expired ? 'expired' : 'submitted';

    // Score model: each correct answer gives 3 points.
    // High-difficulty/perfect bonus requires explanation.
    let awarded = safeCorrect * 3;
    const needsExplanationForBonus = !expired && safeCorrect >= Math.ceil(challenge.questionCount * 0.8);
    const hasValidExplanation = typeof explanation === 'string' && explanation.trim().length >= 60;

    if (!expired && safeCorrect === challenge.questionCount && hasValidExplanation) {
      awarded += 50;
    } else if (!expired && safeCorrect === challenge.questionCount && !hasValidExplanation) {
      awarded += 20;
    }

    const antiCheatFlags: string[] = [];
    const expectedMinSeconds = Math.max(45, challenge.questionCount * 12);
    if (!expired && safeCorrect >= Math.ceil(challenge.questionCount * 0.9) && timeTakenSeconds < expectedMinSeconds) {
      antiCheatFlags.push('too-fast-high-accuracy');
    }
    if (needsExplanationForBonus && !hasValidExplanation) {
      antiCheatFlags.push('missing-high-difficulty-explanation');
    }

    const antiCheatPenalty = antiCheatFlags.length > 0 ? Math.round(awarded * 0.3) : 0;
    awarded = Math.max(0, awarded - antiCheatPenalty);

    challenge.scoreAwarded = awarded;
    challenge.antiCheatFlags = antiCheatFlags;
    challenge.antiCheatPenalty = antiCheatPenalty;
    profile.score = (profile.score || 0) + awarded;
    const profileActivity = profile.activity || {
      calculatorUses: 0,
      solvedQuestions: 0,
      coachActions: 0,
      challengeAttempts: 0,
    };
    profileActivity.solvedQuestions += safeCorrect;
    profile.activity = profileActivity;
    profileChallenges[challengeId] = challenge;
    profile.challenges = profileChallenges;

    db.profiles[studentId] = profile;
    saveStudentDb(db);

    res.json({
      studentId,
      challenge,
      awarded,
      score: profile.score,
      antiCheat: {
        flags: antiCheatFlags,
        penalty: antiCheatPenalty,
        timeTakenSeconds,
      },
      result: expired
        ? 'Submission received after time limit. Base score applied only.'
        : safeCorrect === challenge.questionCount
          ? hasValidExplanation
            ? 'Perfect challenge submission. Bonus awarded.'
            : 'Perfect challenge submission received. Full bonus withheld due to missing explanation.'
          : 'Challenge submitted successfully.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:studentId/plan/daily', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const profile = ensureProfileDefaults(getOrCreateStudentProfile(studentId));
    const requestedClassName = (req.query.className as string) || '';
    const requestedChapter = (req.query.chapter as string) || '';
    const safeTimeAvailableMinutes = Math.max(
      15,
      Math.min(parseInt((req.query.timeAvailableMinutes as string) || '60', 10) || 60, 240)
    );

    const weaknessScores = computeWeaknessScores(profile);
    const candidateKeys = Object.keys(profile.weakness || {}).filter((key) => {
      if (!requestedClassName && !requestedChapter) return true;
      if (requestedClassName && requestedChapter) return key === `${requestedClassName}::${requestedChapter}`;
      if (requestedClassName) return key.startsWith(`${requestedClassName}::`);
      if (requestedChapter) return key.endsWith(`::${requestedChapter}`);
      return true;
    });

    let targetKey = '';
    let bestPriority = -1;
    let selectedFactors = {
      weakness: 0,
      recency: 0,
      completion: 0,
      hardMark: 0,
    };

    for (const key of candidateKeys) {
      const stats = profile.weakness[key];
      const weaknessFactor = weaknessScores[key] || 0;
      const recencyDays = getDaysSince(stats?.updatedAt);
      const recencyFactor = Math.min(20, recencyDays * 1.2);

      const latestCompletion = getLatestPlanCompletionForChapter(profile, key);
      const completionRate = latestCompletion ? latestCompletion.completionRate : 1;
      const completionFactor = latestCompletion ? (1 - completionRate) * 20 : 0;
      const hardMarkFactor = (profile.hardChapterMarks || {})[key] ? 6 : 0;

      const priority = weaknessFactor * 0.6 + recencyFactor * 0.25 + completionFactor * 0.15 + hardMarkFactor;
      if (priority > bestPriority) {
        bestPriority = priority;
        targetKey = key;
        selectedFactors = {
          weakness: Math.round(weaknessFactor * 100) / 100,
          recency: Math.round(recencyFactor * 100) / 100,
          completion: Math.round(completionFactor * 100) / 100,
          hardMark: hardMarkFactor,
        };
      }
    }

    if (!targetKey) {
      targetKey = requestedClassName && requestedChapter
        ? `${requestedClassName}::${requestedChapter}`
        : chooseWeakestChapter(profile) || 'Class 9::Number System';
    }

    const [className, chapterName] = targetKey.split('::');
    const stats = profile.weakness[targetKey] || {
      attempts: 0,
      correct: 0,
      mistakes: {},
      updatedAt: new Date().toISOString(),
    };

    const topMistake = dominantMistake(stats);
    const questionTypes = getQuestionTypesForChapter(className, chapterName);

    const targetQuestionTypes = questionTypes.slice(0, 5);
    const difficultyMix = { easy: 4, medium: 4, hard: 2 };
    const planId = `plan_${crypto.randomUUID()}`;

    const basePerQuestion = safeTimeAvailableMinutes / 10;
    const easyMinutes = Math.max(1, Math.round(basePerQuestion * 0.8));
    const mediumMinutes = Math.max(1, Math.round(basePerQuestion * 1.0));
    const hardMinutes = Math.max(1, Math.round(basePerQuestion * 1.2));

    const plan = Array.from({ length: 10 }).map((_, idx) => {
      const difficulty = idx < 4 ? 'easy' : idx < 8 ? 'medium' : 'hard';
      const qType = questionTypes[idx % Math.max(1, questionTypes.length)] || 'concept application';
      const estimatedMinutes = difficulty === 'easy' ? easyMinutes : difficulty === 'medium' ? mediumMinutes : hardMinutes;

      return {
        questionNumber: idx + 1,
        className,
        chapter: chapterName,
        difficulty,
        questionType: qType,
        focusMistake: topMistake,
        phase: idx < 4 ? 'reinforcement' : idx < 8 ? 'application' : 'challenge',
        sequenceStartMinute: idx === 0 ? 0 : undefined,
        estimatedMinutes,
      };
    });

    let runningMinutes = 0;
    plan.forEach((item, idx) => {
      item.sequenceStartMinute = runningMinutes;
      runningMinutes += item.estimatedMinutes;
    });

    const expectedCompletionMinutes = plan.reduce((sum, item) => sum + item.estimatedMinutes, 0);

    res.json({
      studentId: profile.id,
      alias: profile.alias,
      planId,
      targetChapterKey: targetKey,
      topMistake,
      targetQuestionTypes,
      difficultyMix,
      timeAvailableMinutes: safeTimeAvailableMinutes,
      multiFactorInputs: {
        chapterAccuracy: stats.attempts === 0 ? 0 : Math.round((stats.correct / stats.attempts) * 100),
        dominantMistakeType: topMistake,
        recencyDaysSinceAttempt: Math.round(getDaysSince(stats.updatedAt) * 100) / 100,
        previousPlanCompletionRate: (getLatestPlanCompletionForChapter(profile, targetKey)?.completionRate) ?? null,
        timeAvailableMinutes: safeTimeAvailableMinutes,
      },
      selectionFactors: selectedFactors,
      expectedCompletionMinutes,
      plan,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/:studentId/plan/complete', (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;

    if (!isAuthorizedForStudent(req, studentId)) {
      return res.status(401).json({ error: 'Unauthorized student profile access' });
    }

    const {
      planId,
      targetChapterKey,
      completedQuestions = 0,
      totalQuestions = 10,
      timeSpentMinutes,
    } = req.body || {};

    if (!planId || !targetChapterKey) {
      return res.status(400).json({ error: 'planId and targetChapterKey are required' });
    }

    const safeTotal = Math.max(1, Math.min(parseInt(String(totalQuestions), 10) || 10, 50));
    const safeCompleted = Math.max(0, Math.min(parseInt(String(completedQuestions), 10) || 0, safeTotal));
    const completionRate = Math.round((safeCompleted / safeTotal) * 100) / 100;

    const db = loadStudentDb();
    const profile = ensureProfileDefaults(db.profiles[studentId] || getOrCreateStudentProfile(studentId));

    const record: PlanCompletionRecord = {
      planId: String(planId),
      targetChapterKey: String(targetChapterKey),
      completedQuestions: safeCompleted,
      totalQuestions: safeTotal,
      completionRate,
      timeSpentMinutes: typeof timeSpentMinutes === 'number' ? Math.max(0, timeSpentMinutes) : undefined,
      createdAt: new Date().toISOString(),
    };

    const history = profile.planCompletions || [];
    history.push(record);
    profile.planCompletions = history.slice(-200);

    db.profiles[studentId] = profile;
    saveStudentDb(db);

    res.json({
      studentId,
      planCompletion: record,
      message: 'Plan completion saved for future recommendations.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
