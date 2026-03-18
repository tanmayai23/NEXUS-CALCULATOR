import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Target, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChapterContent {
  id: number;
  name: string;
  formulas: string[];
  question_types: string[];
}

interface CurriculumClass {
  grade: number;
  chapters: ChapterContent[];
}

interface CurriculumData {
  board: string;
  classes: CurriculumClass[];
}

interface WeaknessRecord {
  attempts: number;
  correct: number;
  mistakes?: Record<string, number>;
  updatedAt?: string;
}

interface WeaknessSnapshotResponse {
  studentId: string;
  alias?: string;
  instituteName?: string;
  classGroup?: string;
  score?: number;
  activity?: {
    calculatorUses: number;
    solvedQuestions: number;
    coachActions: number;
    challengeAttempts: number;
  };
  hardChapterMarks?: Record<string, boolean>;
  weakness: Record<string, WeaknessRecord>;
  weaknessScores?: Record<string, number>;
  weakestChapterKey?: string | null;
}

interface DailyPracticeResponse {
  studentId: string;
  targetChapterKey: string | null;
  topMistake?: string;
  recommendation: string;
  practiceSet: string[];
}

interface LeaderboardRow {
  studentId: string;
  alias: string;
  instituteName?: string;
  classGroup?: string;
  score: number;
  rawScore?: number;
  attempts: number;
  overallAccuracy: number;
  chapterMastery: Record<string, number>;
  scoreBreakdown?: {
    activityPoints: number;
    accuracyPoints: number;
    consistencyPoints: number;
    improvementPoints: number;
    weaknessRecoveryBonus: number;
    antiCheatAdjustment: number;
  };
}

interface ProfileHistoryResponse {
  studentId: string;
  alias?: string;
  instituteName?: string;
  classGroup?: string;
  score: number;
  summary: {
    totalAttempts: number;
    totalCorrect: number;
    accuracy: number;
    planCompletionCount: number;
    challengeCount: number;
  };
  planCompletions: Array<{
    planId: string;
    targetChapterKey: string;
    completionRate: number;
    completedQuestions: number;
    totalQuestions: number;
    createdAt: string;
  }>;
  recentChallenges: Array<{
    id: string;
    className: string;
    chapter: string;
    status: 'active' | 'submitted' | 'expired';
    correctAnswers?: number;
    scoreAwarded?: number;
    submittedAt?: string;
  }>;
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
}

interface ChallengeResponse {
  studentId: string;
  challenge: ChallengeAttempt;
  message?: string;
  awarded?: number;
  score?: number;
  result?: string;
}

interface DailyPlanItem {
  questionNumber: number;
  className: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: string;
  focusMistake: string;
  phase?: 'reinforcement' | 'application' | 'challenge';
  sequenceStartMinute?: number;
  estimatedMinutes: number;
}

interface DailyPlanResponse {
  studentId: string;
  alias?: string;
  planId?: string;
  targetChapterKey: string;
  topMistake: string;
  targetQuestionTypes?: string[];
  difficultyMix?: {
    easy: number;
    medium: number;
    hard: number;
  };
  timeAvailableMinutes?: number;
  multiFactorInputs?: {
    chapterAccuracy: number;
    dominantMistakeType: string;
    recencyDaysSinceAttempt: number;
    previousPlanCompletionRate: number | null;
    timeAvailableMinutes: number;
  };
  expectedCompletionMinutes: number;
  plan: DailyPlanItem[];
}

interface AuthSessionResponse {
  user: {
    id: string;
    email: string;
    studentId?: string;
    createdAt: string;
    lastLoginAt: string;
    sessionToken?: string;
    sessionExpiresAt?: string;
  };
  student: {
    studentId: string;
    studentToken: string;
    alias?: string;
  };
}

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; shape?: string; width?: string | number }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface OtpRequestResponse {
  email: string;
  expiresAt: string;
  message: string;
  devOtp?: string;
}

interface AuthConfigResponse {
  google?: {
    enabled: boolean;
    providerReady: boolean;
    clientIdConfigured: boolean;
    message?: string;
  };
}

const STUDENT_ID_KEY = 'nexus-student-profile-id-v1';
const STUDENT_TOKEN_KEY = 'nexus-student-token-v1';
const USER_ID_KEY = 'nexus-user-id-v1';
const USER_EMAIL_KEY = 'nexus-user-email-v1';
const USER_SESSION_TOKEN_KEY = 'nexus-user-session-token-v1';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const NexusLearningCoach: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState('Class 9');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [generatedPractice, setGeneratedPractice] = useState<string[]>([]);
  const [stepInput, setStepInput] = useState('');
  const [verification, setVerification] = useState('');
  const [mistakeType, setMistakeType] = useState('');
  const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);
  const [weaknessTracker, setWeaknessTracker] = useState<Record<string, WeaknessRecord>>({});
  const [studentId, setStudentId] = useState('');
  const [studentToken, setStudentToken] = useState('');
  const [studentAlias, setStudentAlias] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [instituteInput, setInstituteInput] = useState('');
  const [classGroupInput, setClassGroupInput] = useState('');
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'class' | 'institute' | 'chapter-challenge'>('global');
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResponse | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlanItem[]>([]);
  const [dailyPlanMinutes, setDailyPlanMinutes] = useState<number>(0);
  const [dailyPlanId, setDailyPlanId] = useState('');
  const [dailyPlanTargetChapterKey, setDailyPlanTargetChapterKey] = useState('');
  const [dailyPlanTopMistake, setDailyPlanTopMistake] = useState('');
  const [dailyPlanQuestionTypes, setDailyPlanQuestionTypes] = useState<string[]>([]);
  const [dailyPlanDifficultyMix, setDailyPlanDifficultyMix] = useState({ easy: 4, medium: 4, hard: 2 });
  const [dailyPlanTimeAvailableMinutes, setDailyPlanTimeAvailableMinutes] = useState(60);
  const [dailyPlanCompletedQuestions, setDailyPlanCompletedQuestions] = useState(10);
  const [dailyPlanStatusMessage, setDailyPlanStatusMessage] = useState('');
  const [dailyPlanInputs, setDailyPlanInputs] = useState<DailyPlanResponse['multiFactorInputs'] | undefined>(undefined);
  const [studentScore, setStudentScore] = useState<number>(0);
  const [hardChapterMarks, setHardChapterMarks] = useState<Record<string, boolean>>({});
  const [weaknessScores, setWeaknessScores] = useState<Record<string, number>>({});
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [activeChallengeId, setActiveChallengeId] = useState('');
  const [challengeTimeLimit, setChallengeTimeLimit] = useState(900);
  const [challengeCorrectAnswers, setChallengeCorrectAnswers] = useState(10);
  const [challengeExplanation, setChallengeExplanation] = useState('');
  const [challengeResult, setChallengeResult] = useState('');
  const [googleAuthReady, setGoogleAuthReady] = useState(false);
  const [googleBackendEnabled, setGoogleBackendEnabled] = useState(false);
  const [googleBackendMessage, setGoogleBackendMessage] = useState('Checking Google auth status...');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const getAuthHeaders = (token: string): HeadersInit => ({
    'Content-Type': 'application/json',
    'x-student-token': token,
  });

  const fetchWeaknessSnapshot = async (profileId: string, token: string) => {
    const response = await fetch(`http://localhost:3001/api/students/${profileId}/weakness`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load weakness tracker');
    }
    const data: WeaknessSnapshotResponse = await response.json();
    if (data.alias) {
      setStudentAlias(data.alias);
      setAliasInput(data.alias);
    }
    setInstituteInput(data.instituteName || '');
    setClassGroupInput(data.classGroup || '');
    setStudentScore(data.score || 0);
    setHardChapterMarks(data.hardChapterMarks || {});
    setWeaknessScores(data.weaknessScores || {});
    setWeaknessTracker(data.weakness || {});
  };

  const markCurrentChapterHard = async (hard: boolean) => {
    if (!studentId || !studentToken || !selectedClass || !selectedChapter) return;

    const response = await fetch(`http://localhost:3001/api/students/${studentId}/chapters/mark-hard`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        className: selectedClass,
        chapter: selectedChapter,
        hard,
      }),
    });

    if (!response.ok) return;
    await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
  };

  const awardActivityScore = async (activityType: 'calculator' | 'question-solve' | 'coach-use', count = 1) => {
    if (!studentId || !studentToken) return;
    const response = await fetch(`http://localhost:3001/api/students/${studentId}/activity/score`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({ activityType, count }),
    });

    if (!response.ok) return;
    const data = await response.json();
    setStudentScore(data.score || 0);
  };

  const startTimedChallenge = async () => {
    if (!studentId || !studentToken || !selectedClass || !selectedChapter) return;
    setChallengeResult('');
    const response = await fetch(`http://localhost:3001/api/students/${studentId}/challenge/start`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        className: selectedClass,
        chapter: selectedChapter,
        questionCount: 10,
        timeLimitSeconds: challengeTimeLimit,
      }),
    });

    if (!response.ok) {
      setChallengeResult('Could not start challenge.');
      return;
    }

    const data: ChallengeResponse = await response.json();
    setActiveChallengeId(data.challenge.id);
    setChallengeResult(data.message || 'Challenge started.');
    await fetchWeaknessSnapshot(studentId, studentToken);
  };

  const submitTimedChallenge = async () => {
    if (!studentId || !studentToken || !activeChallengeId) {
      setChallengeResult('Start a challenge first.');
      return;
    }

    const response = await fetch(`http://localhost:3001/api/students/${studentId}/challenge/submit`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        challengeId: activeChallengeId,
        correctAnswers: challengeCorrectAnswers,
        explanation: challengeExplanation,
      }),
    });

    if (!response.ok) {
      setChallengeResult('Challenge submit failed.');
      return;
    }

    const data: ChallengeResponse = await response.json();
    setChallengeResult(`${data.result || 'Submitted.'} +${data.awarded || 0} points`);
    setActiveChallengeId('');
    setChallengeExplanation('');
    setStudentScore(data.score || studentScore);
    await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
  };

  const fetchLeaderboard = async (className?: string, chapter?: string) => {
    const params = new URLSearchParams();
    params.set('limit', '12');
    params.set('boardType', leaderboardType);

    const classNameToUse = className || selectedClass;
    const chapterToUse = chapter || selectedChapter;

    if (leaderboardType === 'class' || leaderboardType === 'chapter-challenge') {
      params.set('className', classNameToUse);
    }
    if (leaderboardType === 'chapter-challenge') {
      params.set('chapter', chapterToUse);
    }
    if (leaderboardType === 'institute' && instituteInput.trim()) {
      params.set('instituteName', instituteInput.trim());
    }

    const response = await fetch(`http://localhost:3001/api/students/leaderboard?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to load leaderboard');
    }
    const data = await response.json();
    setLeaderboard(data.leaderboard || []);
  };

  const fetchProfileHistory = async (profileId: string, token: string) => {
    const response = await fetch(`http://localhost:3001/api/students/${profileId}/profile/history`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load profile history');
    }

    const data: ProfileHistoryResponse = await response.json();
    setProfileHistory(data);
  };

  const fetchDailyPlan = async (profileId: string, token: string, className?: string, chapter?: string) => {
    const params = new URLSearchParams();
    params.set('timeAvailableMinutes', String(dailyPlanTimeAvailableMinutes));
    if (className) params.set('className', className);
    if (chapter) params.set('chapter', chapter);

    const response = await fetch(`http://localhost:3001/api/students/${profileId}/plan/daily?${params.toString()}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load daily plan');
    }

    const data: DailyPlanResponse = await response.json();
    setDailyPlan(data.plan || []);
    setDailyPlanId(data.planId || '');
    setDailyPlanTargetChapterKey(data.targetChapterKey || '');
    setDailyPlanTopMistake(data.topMistake || '');
    setDailyPlanQuestionTypes(data.targetQuestionTypes || []);
    setDailyPlanDifficultyMix(data.difficultyMix || { easy: 4, medium: 4, hard: 2 });
    setDailyPlanInputs(data.multiFactorInputs);
    setDailyPlanMinutes(data.expectedCompletionMinutes || 0);
    setDailyPlanStatusMessage('');
    setDailyPlanCompletedQuestions(data.plan?.length || 10);
  };

  const submitDailyPlanCompletion = async () => {
    if (!studentId || !studentToken || !dailyPlanId || !dailyPlanTargetChapterKey || dailyPlan.length === 0) return;

    const response = await fetch(`http://localhost:3001/api/students/${studentId}/plan/complete`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        planId: dailyPlanId,
        targetChapterKey: dailyPlanTargetChapterKey,
        completedQuestions: dailyPlanCompletedQuestions,
        totalQuestions: dailyPlan.length,
        timeSpentMinutes: dailyPlanMinutes,
      }),
    });

    if (!response.ok) {
      setDailyPlanStatusMessage('Could not save plan completion.');
      return;
    }

    setDailyPlanStatusMessage('Plan completion saved. Next recommendation will adapt to this.');
    await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
  };

  const saveAlias = async () => {
    if (!studentId || !studentToken || !aliasInput.trim()) return;

    const response = await fetch(`http://localhost:3001/api/students/${studentId}/alias`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        alias: aliasInput.trim(),
        instituteName: instituteInput.trim(),
        classGroup: classGroupInput.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save alias');
    }

    const data = await response.json();
    setStudentAlias(data.alias || aliasInput.trim());
    await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
  };

  const fetchAdaptivePractice = async (profileId: string, token: string, className?: string, chapter?: string) => {
    const params = new URLSearchParams();
    params.set('limit', '5');
    if (className) params.set('className', className);
    if (chapter) params.set('chapter', chapter);

    const response = await fetch(`http://localhost:3001/api/students/${profileId}/practice/daily?${params.toString()}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load adaptive daily practice');
    }
    const data: DailyPracticeResponse = await response.json();
    setAdaptiveRecommendation(data.recommendation || '');
    setGeneratedPractice(data.practiceSet || []);
  };

  const refreshLearningPanels = async (
    profileId: string,
    token: string,
    className?: string,
    chapter?: string
  ) => {
    // Required order: weakness -> adaptive recommendation -> daily plan -> leaderboard.
    await fetchWeaknessSnapshot(profileId, token);
    await fetchAdaptivePractice(profileId, token, className, chapter);
    await fetchDailyPlan(profileId, token, className, chapter);
    await fetchLeaderboard(className, chapter);
    await fetchProfileHistory(profileId, token);
  };

  useEffect(() => {
    if (!studentId || !studentToken) return;

    const handleExternalRefresh = () => {
      refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter).catch((error) => {
        console.error('External learning refresh error:', error);
      });
    };

    window.addEventListener('nexus:learning-refresh', handleExternalRefresh);
    return () => window.removeEventListener('nexus:learning-refresh', handleExternalRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, studentToken, selectedClass, selectedChapter]);

  useEffect(() => {
    if (!studentId || !studentToken) return;
    refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter).catch((error) => {
      console.error('Leaderboard type refresh error:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardType]);

  const applyStudentSession = async (profileId: string, token: string, alias: string) => {
    localStorage.setItem(STUDENT_ID_KEY, profileId);
    localStorage.setItem(STUDENT_TOKEN_KEY, token);
    setStudentId(profileId);
    setStudentToken(token);
    setStudentAlias(alias);
    setAliasInput(alias);

    await refreshLearningPanels(profileId, token, selectedClass, selectedChapter);
  };

  const requestOtp = async () => {
    if (!emailInput.trim()) {
      setAuthMessage('Enter your email first.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to request OTP');
      }

      const data: OtpRequestResponse = await response.json();
      setAuthMessage(data.devOtp ? `OTP sent. Dev OTP: ${data.devOtp}` : 'OTP sent to your email.');
    } catch (error) {
      setAuthMessage('Failed to request OTP.');
      console.error(error);
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOtpAndLogin = async () => {
    if (!emailInput.trim() || !otpInput.trim()) {
      setAuthMessage('Enter both email and OTP.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          otp: otpInput.trim(),
          guestStudentId: studentId || undefined,
          guestToken: studentToken || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('OTP verification failed');
      }

      const data: AuthSessionResponse = await response.json();
      localStorage.setItem(USER_ID_KEY, data.user.id);
      localStorage.setItem(USER_EMAIL_KEY, data.user.email);
      if (data.user.sessionToken) {
        localStorage.setItem(USER_SESSION_TOKEN_KEY, data.user.sessionToken);
      }
      setUserId(data.user.id);
      setUserEmail(data.user.email);

      await applyStudentSession(data.student.studentId, data.student.studentToken, data.student.alias || '');
      setAuthMessage('Logged in successfully. Your guest progress is now linked.');
    } catch (error) {
      setAuthMessage('Invalid OTP or login failed.');
      console.error(error);
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyGoogleAndLogin = async (idToken: string) => {
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const response = await fetch('http://localhost:3001/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          guestStudentId: studentId || undefined,
          guestToken: studentToken || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Google login failed');
      }

      const data: AuthSessionResponse = await response.json();
      localStorage.setItem(USER_ID_KEY, data.user.id);
      localStorage.setItem(USER_EMAIL_KEY, data.user.email);
      if (data.user.sessionToken) {
        localStorage.setItem(USER_SESSION_TOKEN_KEY, data.user.sessionToken);
      }

      setUserId(data.user.id);
      setUserEmail(data.user.email);
      setEmailInput(data.user.email);
      await applyStudentSession(data.student.studentId, data.student.studentToken, data.student.alias || '');
      setAuthMessage('Google login successful. Guest progress linked securely.');
    } catch (error) {
      setAuthMessage('Google login failed. Please try OTP login.');
      console.error(error);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/auth/config');
        if (!response.ok) {
          throw new Error('Failed to load auth config');
        }

        const data: AuthConfigResponse = await response.json();
        setGoogleBackendEnabled(!!data.google?.enabled);
        setGoogleBackendMessage(data.google?.message || 'Google auth configuration unavailable.');
      } catch (error) {
        setGoogleBackendEnabled(false);
        setGoogleBackendMessage('Could not verify Google auth health from backend.');
        console.error(error);
      }
    };

    loadAuthConfig().catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBackendEnabled || !googleButtonRef.current) {
      setGoogleAuthReady(false);
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            setAuthMessage('Google credential missing. Try again.');
            return;
          }
          verifyGoogleAndLogin(response.credential).catch((error) => console.error(error));
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'medium',
        shape: 'pill',
        width: 260,
      });
      setGoogleAuthReady(true);
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const scriptId = 'google-identity-services';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton);
      return () => existingScript.removeEventListener('load', renderGoogleButton);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GOOGLE_CLIENT_ID, googleBackendEnabled, studentId, studentToken]);

  const logout = () => {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(USER_SESSION_TOKEN_KEY);
    setUserId('');
    setUserEmail('');
    setAuthMessage('Logged out. You can still continue as guest.');
  };

  // Bootstrap runs once on mount to restore/create session and initial curriculum state.
  useEffect(() => {
    const loadCurriculum = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/curriculum/ncert');
        if (!response.ok) throw new Error('Failed to load curriculum');
        const data: CurriculumData = await response.json();
        setCurriculumData(data);

        const firstClass = data.classes[0];
        if (firstClass) {
          const classLabel = `Class ${firstClass.grade}`;
          setSelectedClass(classLabel);
          setSelectedChapter(firstClass.chapters[0]?.name || '');
        }
      } catch (error) {
        console.error('Curriculum load error:', error);
      }
    };

    const bootstrapStudentProfile = async () => {
      try {
        const savedUserId = localStorage.getItem(USER_ID_KEY);
        const savedUserEmail = localStorage.getItem(USER_EMAIL_KEY);
        const savedSessionToken = localStorage.getItem(USER_SESSION_TOKEN_KEY);
        const savedId = localStorage.getItem(STUDENT_ID_KEY);
        const savedToken = localStorage.getItem(STUDENT_TOKEN_KEY);

        if (savedUserId && savedSessionToken) {
          const restoreResponse = await fetch('http://localhost:3001/api/auth/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: savedUserId, sessionToken: savedSessionToken }),
          });

          if (restoreResponse.ok) {
            const session: AuthSessionResponse = await restoreResponse.json();
            setUserId(session.user.id);
            setUserEmail(savedUserEmail || session.user.email);
            if (session.user.sessionToken) {
              localStorage.setItem(USER_SESSION_TOKEN_KEY, session.user.sessionToken);
            }
            setEmailInput(savedUserEmail || session.user.email);
            await applyStudentSession(
              session.student.studentId,
              session.student.studentToken,
              session.student.alias || ''
            );
            return;
          }
        }

        const response = await fetch('http://localhost:3001/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(savedId && savedToken ? { 'x-student-token': savedToken } : {}),
          },
          body: JSON.stringify({ studentId: savedId || undefined }),
        });

        if (!response.ok) throw new Error('Failed to create student profile');
        const data = await response.json();
        const profileId = data.studentId as string;
        const token = data.studentToken as string;
        const alias = (data.alias as string) || '';

        await applyStudentSession(profileId, token, alias);
      } catch (error) {
        console.error('Student profile bootstrap error:', error);
      }
    };

    loadCurriculum();
    bootstrapStudentProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classes = useMemo(() => {
    if (!curriculumData) return [] as string[];
    return curriculumData.classes.map((item) => `Class ${item.grade}`);
  }, [curriculumData]);

  const activeClass = useMemo(() => {
    if (!curriculumData) return undefined;
    const grade = parseInt(selectedClass.replace('Class ', ''), 10);
    return curriculumData.classes.find((item) => item.grade === grade);
  }, [curriculumData, selectedClass]);

  const chapters = useMemo(() => activeClass?.chapters.map((item) => item.name) || [], [activeClass]);

  const chapterData: ChapterContent | undefined = useMemo(
    () => activeClass?.chapters.find((item) => item.name === selectedChapter),
    [activeClass, selectedChapter]
  );

  const importantStatements = useMemo(() => {
    if (!chapterData) return [] as string[];
    const statements = chapterData.formulas.filter((item) => {
      const normalized = item.toLowerCase();
      return normalized.includes('=') || normalized.includes('if') || normalized.includes('sum');
    });

    if (statements.length > 0) return statements.slice(0, 4);
    return chapterData.question_types.slice(0, 3).map((item) => `Key focus: ${item}`);
  }, [chapterData]);

  const chapterKey = `${selectedClass}::${selectedChapter}`;
  const chapterStats = weaknessTracker[chapterKey] || { attempts: 0, correct: 0 };
  const chapterAccuracy = chapterStats.attempts === 0 ? 0 : Math.round((chapterStats.correct / chapterStats.attempts) * 100);
  const chapterWeaknessScore = weaknessScores[chapterKey] || 0;
  const chapterHardMarked = !!hardChapterMarks[chapterKey];

  const recommendation = useMemo(() => {
    if (adaptiveRecommendation) return adaptiveRecommendation;

    const entries = Object.entries(weaknessTracker);
    if (entries.length === 0) {
      return 'Start with this chapter and solve 3 easy practice questions.';
    }

    let weakestKey = entries[0][0];
    let weakestScore = 101;

    entries.forEach(([key, value]) => {
      const accuracy = value.attempts === 0 ? 0 : (value.correct / value.attempts) * 100;
      if (accuracy < weakestScore) {
        weakestScore = accuracy;
        weakestKey = key;
      }
    });

    const weakChapter = weakestKey.split('::')[1] || 'current chapter';
    return `Recommended next practice: ${weakChapter}. Focus on medium-level questions first.`;
  }, [adaptiveRecommendation, weaknessTracker]);

  const classifyMistake = (step: string): string => {
    if (!chapterData) return 'unknown';

    const lower = step.toLowerCase();
    const hasSignPattern = (lower.includes('+') && lower.includes('-')) || lower.includes('minus') || lower.includes('negative');
    const hasFormulaReference = lower.includes('formula') || lower.includes('theorem') || lower.includes('using');
    const formulaMatch = chapterData.formulas.some((item) => {
      const token = item.split('=')[0]?.trim().toLowerCase();
      return token && lower.includes(token.slice(0, Math.min(token.length, 6)));
    });

    const theoremKeywords = ['congruent', 'parallel', 'transversal', 'chord', 'radius', 'bisect', 'similar'];
    const theoremMentioned = theoremKeywords.some((item) => lower.includes(item));
    const chapterTheoremHint = chapterData.question_types.join(' ').toLowerCase();

    if (theoremMentioned && !chapterTheoremHint.includes(theoremKeywords.find((item) => lower.includes(item)) || '')) {
      return 'theorem-misuse';
    }

    if (hasFormulaReference && !formulaMatch) {
      return 'formula-choice';
    }

    if (hasSignPattern && (lower.includes('wrong') || lower.includes('change') || lower.includes('cancel'))) {
      return 'sign-error';
    }

    if (!formulaMatch && !theoremMentioned) {
      return 'formula-choice';
    }

    return 'correct-direction';
  };

  const updateWeakness = async (isCorrect: boolean, detectedMistake: string) => {
    if (!studentId || !studentToken || !selectedClass || !selectedChapter) return;

    const response = await fetch(`http://localhost:3001/api/students/${studentId}/weakness/update`, {
      method: 'POST',
      headers: getAuthHeaders(studentToken),
      body: JSON.stringify({
        className: selectedClass,
        chapter: selectedChapter,
        isCorrect,
        mistakeType: detectedMistake,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update weakness tracker');
    }

    await awardActivityScore('coach-use', 1);
  };

  const generatePractice = async () => {
    if (!chapterData) return;
    if (!studentId || !studentToken) {
      setGeneratedPractice([
        `Easy: Solve one ${chapterData.question_types[0]?.toLowerCase() || 'concept'} problem from ${selectedChapter}.`,
        `Medium: Solve one application question from ${selectedChapter}.`,
        `Hard: Solve one proof/reasoning question from ${selectedChapter}.`,
      ]);
      return;
    }

    try {
      await fetchAdaptivePractice(studentId, studentToken, selectedClass, selectedChapter);
    } catch (error) {
      console.error('Practice generation error:', error);
    }
  };

  const verifyStep = async () => {
    if (!stepInput.trim() || !chapterData) {
      setVerification('Enter your step first.');
      return;
    }

    const combinedKeywords = [
      ...chapterData.formulas,
      ...importantStatements,
      ...chapterData.question_types,
    ]
      .join(' ')
      .toLowerCase();

    const tokens = stepInput.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
    const overlap = tokens.some((token) => combinedKeywords.includes(token));
    const detectedMistake = classifyMistake(stepInput);
    setMistakeType(detectedMistake);

    try {
      if (overlap) {
        setVerification('Good step direction. It aligns with this chapter concepts.');
        await updateWeakness(true, 'correct-direction');
        await awardActivityScore('question-solve', 1);
        await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
      } else {
        setVerification('Step may be off-topic. Recheck chapter formula/theorem selection.');
        await updateWeakness(false, detectedMistake);
        await refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter);
      }
    } catch (error) {
      console.error('Weakness update error:', error);
    }
  };

  return (
    <div className="nexus-panel h-full p-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-5 h-5 text-nexus-primary-bright" />
        <h3 className="font-medium">Chapter Coach</h3>
      </div>

      <div className="mb-3 space-y-2">
        <div className="bg-white/5 border border-white/10 rounded-md p-3 space-y-2">
          <p className="text-xs text-white/60">Optional Login (Email OTP)</p>
          <div className="flex items-center gap-2">
            <input
              className="nexus-input flex-1"
              placeholder="Enter email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <Button variant="outline" onClick={() => requestOtp().catch((error) => console.error(error))} disabled={authLoading}>
              Send OTP
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="nexus-input flex-1"
              placeholder="Enter OTP"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
            />
            <Button onClick={() => verifyOtpAndLogin().catch((error) => console.error(error))} disabled={authLoading}>
              Verify Login
            </Button>
          </div>
          <div className="border-t border-white/10 pt-2">
            <p className="text-xs text-white/60 mb-2">Or continue with Google</p>
            {GOOGLE_CLIENT_ID && googleBackendEnabled ? (
              <>
                <div ref={googleButtonRef} />
                <Button
                  variant="outline"
                  className="mt-2"
                  disabled={!googleAuthReady || authLoading}
                  onClick={() => window.google?.accounts?.id?.prompt()}
                >
                  Continue with Google
                </Button>
              </>
            ) : (
              <p className="text-xs text-white/50">
                {googleBackendMessage}
                {!GOOGLE_CLIENT_ID ? ' Missing VITE_GOOGLE_CLIENT_ID in frontend env.' : ''}
              </p>
            )}
          </div>
          {userId && userEmail && (
            <div className="flex items-center justify-between text-xs text-white/75">
              <span>Signed in as {userEmail}</span>
              <Button variant="outline" onClick={logout}>Logout</Button>
            </div>
          )}
          {authMessage && <p className="text-xs text-nexus-primary-bright">{authMessage}</p>}
        </div>

        {studentId && (
          <>
            <p className="text-xs text-white/60">Student Profile: {studentId}</p>
            <div className="flex items-center gap-2">
              <input
                className="nexus-input flex-1"
                placeholder="Set your learner name"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
              />
              <Button variant="outline" onClick={() => saveAlias().catch((error) => console.error(error))}>
                Save Name
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                className="nexus-input"
                placeholder="Institute (for institute leaderboard/dashboard)"
                value={instituteInput}
                onChange={(e) => setInstituteInput(e.target.value)}
              />
              <input
                className="nexus-input"
                placeholder="Class Group (e.g. 10-A)"
                value={classGroupInput}
                onChange={(e) => setClassGroupInput(e.target.value)}
              />
            </div>
            {studentAlias && <p className="text-xs text-white/70">Welcome, {studentAlias}</p>}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <select
          className="nexus-input"
          value={selectedClass}
          onChange={(e) => {
            const nextClass = e.target.value;
            setSelectedClass(nextClass);
            const nextClassObj = curriculumData?.classes.find((item) => `Class ${item.grade}` === nextClass);
            const nextChapters = nextClassObj?.chapters.map((item) => item.name) || [];
            const nextChapter = nextChapters[0] || '';
            setSelectedChapter(nextChapter);
            setGeneratedPractice([]);
            setVerification('');
            setMistakeType('');

            if (studentId && studentToken && nextChapter) {
              fetchAdaptivePractice(studentId, studentToken, nextClass, nextChapter).catch((error) => {
                console.error('Adaptive recommendation update error:', error);
              });
              fetchDailyPlan(studentId, studentToken, nextClass, nextChapter).catch((error) => {
                console.error('Daily plan refresh error:', error);
              });
              fetchLeaderboard(nextClass, nextChapter).catch((error) => {
                console.error('Leaderboard refresh error:', error);
              });
            }
          }}
        >
          {classes.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>

        <select
          className="nexus-input"
          value={selectedChapter}
          onChange={(e) => {
            const nextChapter = e.target.value;
            setSelectedChapter(nextChapter);
            setGeneratedPractice([]);
            setVerification('');
            setMistakeType('');

            if (studentId && studentToken) {
              fetchAdaptivePractice(studentId, studentToken, selectedClass, nextChapter).catch((error) => {
                console.error('Adaptive recommendation update error:', error);
              });
              fetchDailyPlan(studentId, studentToken, selectedClass, nextChapter).catch((error) => {
                console.error('Daily plan refresh error:', error);
              });
              fetchLeaderboard(selectedClass, nextChapter).catch((error) => {
                console.error('Leaderboard refresh error:', error);
              });
            }
          }}
        >
          {chapters.map((chapter) => (
            <option key={chapter} value={chapter}>
              {chapter}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Formulas</h4>
          <ul className="text-sm text-white/85 list-disc pl-5 space-y-1">
            {chapterData?.formulas.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Important Statements</h4>
          <ul className="text-sm text-white/85 list-disc pl-5 space-y-1">
            {importantStatements.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Typical Question Types</h4>
          <ul className="text-sm text-white/85 list-disc pl-5 space-y-1">
            {chapterData?.question_types.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Button className="mt-3 bg-nexus-primary-bright hover:bg-nexus-primary-bright/80" onClick={generatePractice}>
            <Target className="w-4 h-4 mr-2" />
            Generate Practice Set
          </Button>
          {generatedPractice.length > 0 && (
            <ul className="mt-3 text-sm text-white/85 list-disc pl-5 space-y-1">
              {generatedPractice.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Step Verifier (beta)</h4>
          <textarea
            className="nexus-input w-full min-h-[90px]"
            placeholder="Enter your current solution step..."
            value={stepInput}
            onChange={(e) => setStepInput(e.target.value)}
          />
          <Button className="mt-2" variant="outline" onClick={verifyStep}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Verify Step
          </Button>
          {verification && <p className="mt-2 text-sm text-white/85">{verification}</p>}
          {mistakeType && (
            <div className="mt-2 text-sm text-yellow-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Mistake Analyzer: {mistakeType}
            </div>
          )}
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Weakness Tracker
          </h4>
          <p className="text-sm text-white/85">Score: {studentScore}</p>
          <p className="text-sm text-white/85">Attempts: {chapterStats.attempts}</p>
          <p className="text-sm text-white/85">Correct direction count: {chapterStats.correct}</p>
          <p className="text-sm text-white/85">Accuracy: {chapterAccuracy}%</p>
          <p className="text-sm text-white/85">Behavior Weakness Score: {chapterWeaknessScore}</p>
          <p className="text-xs text-white/60">Higher score means higher support priority.</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => markCurrentChapterHard(true).catch((error) => console.error(error))}
            >
              Mark Hard
            </Button>
            <Button
              variant="outline"
              onClick={() => markCurrentChapterHard(false).catch((error) => console.error(error))}
            >
              Clear Hard Mark
            </Button>
            <span className="text-xs text-white/70">Self-mark: {chapterHardMarked ? 'On' : 'Off'}</span>
          </div>
          {chapterStats.mistakes && Object.keys(chapterStats.mistakes).length > 0 && (
            <p className="text-sm text-white/85 mt-1">
              Top mistake: {Object.entries(chapterStats.mistakes).sort((a, b) => b[1] - a[1])[0]?.[0]}
            </p>
          )}
          <p className="mt-2 text-sm text-nexus-primary-bright">{recommendation}</p>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Daily Adaptive Plan (10 Questions)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <input
              className="nexus-input"
              type="number"
              min={15}
              max={240}
              value={dailyPlanTimeAvailableMinutes}
              onChange={(e) => setDailyPlanTimeAvailableMinutes(parseInt(e.target.value || '60', 10))}
              placeholder="Time available (minutes)"
            />
            <Button
              variant="outline"
              onClick={() => fetchDailyPlan(studentId, studentToken, selectedClass, selectedChapter).catch((error) => console.error(error))}
            >
              Regenerate Plan
            </Button>
          </div>
          <p className="text-xs text-white/70 mb-1">Target chapter: {dailyPlanTargetChapterKey || chapterKey}</p>
          <p className="text-xs text-white/70 mb-1">Dominant mistake focus: {dailyPlanTopMistake || 'n/a'}</p>
          <p className="text-xs text-white/70 mb-1">
            Difficulty mix: E{dailyPlanDifficultyMix.easy}-M{dailyPlanDifficultyMix.medium}-H{dailyPlanDifficultyMix.hard}
          </p>
          {dailyPlanQuestionTypes.length > 0 && (
            <p className="text-xs text-white/70 mb-1">Question types: {dailyPlanQuestionTypes.join(', ')}</p>
          )}
          {dailyPlanInputs && (
            <p className="text-xs text-white/60 mb-2">
              Factors used: accuracy {dailyPlanInputs.chapterAccuracy}%, recency {dailyPlanInputs.recencyDaysSinceAttempt} days,
              prior completion {dailyPlanInputs.previousPlanCompletionRate ?? 'n/a'}, time {dailyPlanInputs.timeAvailableMinutes} min.
            </p>
          )}
          <p className="text-sm text-white/85 mb-2">Expected completion time: {dailyPlanMinutes} minutes</p>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {dailyPlan.map((item) => (
              <div key={item.questionNumber} className="text-sm text-white/85 border border-white/10 rounded px-2 py-1">
                Q{item.questionNumber} [{item.difficulty}] {item.questionType} ({item.estimatedMinutes} min)
                {typeof item.sequenceStartMinute === 'number' ? ` - start at ${item.sequenceStartMinute}m` : ''}
                {item.phase ? ` - ${item.phase}` : ''}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <input
              className="nexus-input"
              type="number"
              min={0}
              max={dailyPlan.length || 10}
              value={dailyPlanCompletedQuestions}
              onChange={(e) => setDailyPlanCompletedQuestions(parseInt(e.target.value || '0', 10))}
              placeholder="Completed questions"
            />
            <Button variant="outline" onClick={() => submitDailyPlanCompletion().catch((error) => console.error(error))}>
              Save Plan Completion
            </Button>
          </div>
          {dailyPlanStatusMessage && <p className="text-xs text-nexus-primary-bright mt-2">{dailyPlanStatusMessage}</p>}
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Timed 10-Question Challenge</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <input
              className="nexus-input"
              type="number"
              min={60}
              max={3600}
              value={challengeTimeLimit}
              onChange={(e) => setChallengeTimeLimit(parseInt(e.target.value || '900', 10))}
              placeholder="Time limit seconds"
            />
            <input
              className="nexus-input"
              type="number"
              min={0}
              max={10}
              value={challengeCorrectAnswers}
              onChange={(e) => setChallengeCorrectAnswers(parseInt(e.target.value || '0', 10))}
              placeholder="Correct answers"
            />
          </div>
          <textarea
            className="nexus-input w-full min-h-[70px] mb-2"
            placeholder="Add brief explanation for high-difficulty bonus (recommended)"
            value={challengeExplanation}
            onChange={(e) => setChallengeExplanation(e.target.value)}
          />
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" onClick={() => startTimedChallenge().catch((error) => console.error(error))}>
              Start Challenge
            </Button>
            <Button onClick={() => submitTimedChallenge().catch((error) => console.error(error))}>
              Submit Challenge
            </Button>
          </div>
          <p className="text-xs text-white/70">Active Challenge ID: {activeChallengeId || 'None'}</p>
          {challengeResult && <p className="text-xs text-nexus-primary-bright mt-1">{challengeResult}</p>}
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Leaderboard Heatmap</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <select
              className="nexus-input"
              value={leaderboardType}
              onChange={(e) => {
                setLeaderboardType(e.target.value as 'global' | 'class' | 'institute' | 'chapter-challenge');
              }}
            >
              <option value="global">Global</option>
              <option value="class">Class-wise</option>
              <option value="institute">Institute-wise</option>
              <option value="chapter-challenge">Chapter Challenge</option>
            </select>
            <Button
              variant="outline"
              onClick={() => refreshLearningPanels(studentId, studentToken, selectedClass, selectedChapter).catch((error) => console.error(error))}
            >
              Refresh Board
            </Button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {leaderboard.map((row, idx) => {
              const intensity = Math.max(10, row.overallAccuracy);
              return (
                <div key={row.studentId} className="border border-white/10 rounded p-2">
                  <div className="flex items-center justify-between text-sm text-white/90">
                    <span>#{idx + 1} {row.alias}</span>
                    <span>{row.score} pts</span>
                  </div>
                  {(row.instituteName || row.classGroup) && (
                    <div className="text-xs text-white/60">
                      {row.instituteName || 'No Institute'} {row.classGroup ? ` | ${row.classGroup}` : ''}
                    </div>
                  )}
                  <div className="text-xs text-white/70">Accuracy: {row.overallAccuracy}%</div>
                  {row.scoreBreakdown && (
                    <div className="text-[11px] text-white/60 mt-1">
                      A:{row.scoreBreakdown.activityPoints} Q:{row.scoreBreakdown.accuracyPoints} C:{row.scoreBreakdown.consistencyPoints} I:{row.scoreBreakdown.improvementPoints} R:{row.scoreBreakdown.weaknessRecoveryBonus}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(row.chapterMastery).slice(0, 8).map(([key, score]) => (
                      <div
                        key={key}
                        title={`${key}: ${score}%`}
                        className="w-6 h-4 rounded"
                        style={{ backgroundColor: `rgba(80, 220, 140, ${Math.max(0.15, score / 100)})` }}
                      />
                    ))}
                    {Object.keys(row.chapterMastery).length === 0 && (
                      <div className="text-xs text-white/50">No chapter attempts yet</div>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-white/10 overflow-hidden">
                    <div className="h-full" style={{ width: `${row.overallAccuracy}%`, background: `rgba(80, 220, 140, ${intensity / 100})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Profile Progress History</h4>
          {!profileHistory ? (
            <p className="text-xs text-white/70">No history loaded yet.</p>
          ) : (
            <div className="space-y-2 text-xs text-white/80">
              <p>
                Attempts: {profileHistory.summary.totalAttempts} | Accuracy: {profileHistory.summary.accuracy}% | Plan completions: {profileHistory.summary.planCompletionCount}
              </p>
              <p>
                Institute: {profileHistory.instituteName || 'Not set'} | Class Group: {profileHistory.classGroup || 'Not set'}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {profileHistory.planCompletions.slice(0, 6).map((entry) => (
                  <div key={entry.planId} className="border border-white/10 rounded px-2 py-1">
                    {entry.targetChapterKey} - {Math.round(entry.completionRate * 100)}% complete
                  </div>
                ))}
                {profileHistory.planCompletions.length === 0 && <p className="text-white/60">No plan history yet.</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default NexusLearningCoach;
