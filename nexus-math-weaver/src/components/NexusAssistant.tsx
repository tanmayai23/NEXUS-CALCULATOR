import React, { useState } from 'react';
import { Brain, MessageSquare, User, BrainCircuit } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  content: string;
  // Optional structured payload for solver answers.
  answer?: string;
  steps?: string[];
  formula?: string;
  chapter?: string;
  confidence?: number;
}

interface AutoSolveResponse {
  tier?: string;
  route?: string;
  answer?: string | number;
  solution?: string;
  confidence?: number;
  steps?: string[];
  method?: string;
  chapter?: string;
  grade?: number;
  relevant_formulas?: string[];
  error?: string;
}

const SOLVE_ENDPOINT = 'http://localhost:3001/api/solve/auto';

// Heuristic: does this message look like something the math solver should handle?
const looksLikeMath = (text: string): boolean => {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/[0-9=]/.test(t) && /[-+*/^()xyznaθπ%]|sqrt|sin|cos|tan|log|integ/.test(t)) return true;
  return /\b(solve|simplify|factor|expand|differentiate|derivative|integrate|integral|limit|evaluate|calculate|hcf|gcd|lcm|factorial|mean|median|mode|determinant|matrix|area|volume|circumference|perimeter|probability|combination|permutation|ncr|npr|choose)\b/.test(t);
};

const NexusAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      sender: 'assistant',
      timestamp: new Date(),
      content:
        "Hi! I'm NEXUS. Type a maths question here and I'll solve it with full steps — e.g. \"solve x^2 - 5x + 6 = 0\", \"differentiate x^3 + sin(x)\", \"15% of 200\".",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const pushMessage = (m: Omit<Message, 'id' | 'timestamp'>) =>
    setMessages((prev) => [
      ...prev,
      { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date() },
    ]);

  const smallTalk = (msg: string): string | null => {
    const m = msg.toLowerCase();
    if (/\b(hi|hello|hey)\b/.test(m)) {
      return "Hello! Ask me a maths question (e.g. \"factorize x^2 - 9\" or \"integrate x^2 from 0 to 3\") and I'll work it out step by step.";
    }
    if (/\b(help|what can you do|how do you work)\b/.test(m)) {
      return 'I can solve arithmetic, fractions, algebra (factor/expand/simplify), equations & systems, quadratics, calculus (derivatives, integrals, limits), matrices, and common word problems (HCF/LCM, sum of n, nCr/nPr, factorial, mean/median/mode, areas). I show the steps and the relevant NCERT chapter & formula.';
    }
    if (/\bthank/.test(m)) return "You're welcome!";
    return null;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isBusy) return;

    pushMessage({ sender: 'user', content: text });
    setInputValue('');

    // Pure conversational replies don't need the solver.
    const chat = smallTalk(text);
    if (chat && !looksLikeMath(text)) {
      pushMessage({ sender: 'assistant', content: chat });
      return;
    }

    setIsBusy(true);
    try {
      const res = await fetch(SOLVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Solver returned ${res.status}`);
      }
      const data: AutoSolveResponse = await res.json();
      const answer = data.answer !== undefined && data.answer !== null ? String(data.answer) : '—';
      const steps =
        Array.isArray(data.steps) && data.steps.length
          ? data.steps
          : data.solution
          ? data.solution.split('\n').filter((s) => s.trim())
          : [];
      const formula =
        data.relevant_formulas && data.relevant_formulas.length
          ? data.relevant_formulas.join('   •   ')
          : undefined;
      const chapter = data.chapter
        ? `NCERT${data.grade ? ` Class ${data.grade}` : ''} — ${data.chapter}`
        : undefined;

      pushMessage({
        sender: 'assistant',
        content: `Answer: ${answer}`,
        answer,
        steps,
        formula,
        chapter,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      pushMessage({
        sender: 'assistant',
        content:
          `I couldn't solve that (${msg}). Make sure the backend is running on :3001, ` +
          `or try rephrasing as a direct expression / equation / derivative / integral.`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="nexus-panel h-full flex flex-col">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-nexus-primary-bright w-5 h-5" />
          <h3 className="font-medium">NEXUS Assistant</h3>
        </div>
        <div
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            isBusy ? 'bg-nexus-primary-bright animate-pulse' : 'bg-green-500',
          )}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-2 max-w-[92%]', message.sender === 'user' ? 'ml-auto' : 'mr-auto')}
          >
            {message.sender === 'assistant' && (
              <Avatar className="w-8 h-8 border border-nexus-primary-bright/50 bg-nexus-primary-bright/20 shrink-0">
                <Brain className="w-4 h-4 text-nexus-primary-bright" />
              </Avatar>
            )}

            <div
              className={cn(
                'rounded-lg p-3 text-sm',
                message.sender === 'user'
                  ? 'bg-nexus-primary-bright text-white ml-2'
                  : 'bg-white/10 text-white/90',
              )}
            >
              {message.answer !== undefined ? (
                <div className="space-y-2">
                  <p>
                    <span className="text-white/60">Answer: </span>
                    <span className="font-semibold text-nexus-primary-bright break-words">{message.answer}</span>
                    {typeof message.confidence === 'number' && (
                      <span className="ml-2 text-[11px] text-white/40">
                        confidence {Math.round(message.confidence * 100)}%
                      </span>
                    )}
                  </p>
                  {message.steps && message.steps.length > 0 && (
                    <div>
                      <p className="text-white/60 text-xs mb-1">Steps</p>
                      <ol className="list-decimal pl-5 space-y-0.5 text-white/85 whitespace-pre-wrap">
                        {message.steps.map((s, i) => (
                          <li key={`${i}-${s.slice(0, 20)}`}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {message.formula && (
                    <p className="text-white/70 text-xs">
                      <span className="text-white/50">Formula: </span>
                      {message.formula}
                    </p>
                  )}
                  {message.chapter && (
                    <p className="text-white/70 text-xs">
                      <span className="text-white/50">Reference: </span>
                      {message.chapter}
                    </p>
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>

            {message.sender === 'user' && (
              <Avatar className="w-8 h-8 border border-white/30 bg-white/20 shrink-0">
                <User className="w-4 h-4" />
              </Avatar>
            )}
          </div>
        ))}

        {isBusy && (
          <div className="flex gap-2 max-w-[92%]">
            <Avatar className="w-8 h-8 border border-nexus-primary-bright/50 bg-nexus-primary-bright/20 shrink-0">
              <Brain className="w-4 h-4 text-nexus-primary-bright animate-pulse" />
            </Avatar>
            <div className="rounded-lg p-3 bg-white/10 text-white/90">
              <div className="flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse animation-delay-200">●</span>
                <span className="animate-pulse animation-delay-400">●</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask NEXUS a maths question..."
            className="nexus-input flex-1"
          />
          <button type="submit" className="nexus-button" disabled={isBusy}>
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default NexusAssistant;
