import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BrainCircuit, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Lightbulb,
  Target,
  Zap,
  Clock,
  BarChart3
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface SolverResult {
  answer: number;
  solution: string;
  confidence: number;
  method: string;
  total_time?: number;
  num_attempts?: number;
}

interface AIMO3SolverProps {
  onSolutionFound?: (result: SolverResult) => void;
}

const AIMO3Solver: React.FC<AIMO3SolverProps> = ({ onSolutionFound }) => {
  const [problem, setProblem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState({
    numSamples: 4,
    timeBudget: 120,
    useGpu: false
  });

  const sampleProblems = [
    {
      title: "Modular Arithmetic",
      problem: "What is the remainder when 2^100 is divided by 7?"
    },
    {
      title: "Sum of Integers",
      problem: "What is the sum of the first 100 positive integers?"
    },
    {
      title: "GCD Problem",
      problem: "Find the greatest common divisor (GCD) of 48 and 18."
    },
    {
      title: "Factorial",
      problem: "What is the value of 7! (7 factorial)?"
    },
    {
      title: "Binomial Coefficient",
      problem: "How many ways can you choose 3 items from 10 items? (Calculate C(10,3))"
    }
  ];

  const solveProblem = async () => {
    if (!problem.trim()) {
      toast.error('Please enter a math problem');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setResult(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, settings.timeBudget * 10);

    try {
      const response = await fetch('http://localhost:3001/api/aimo3/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problem,
          num_samples: settings.numSamples,
          time_budget: settings.timeBudget,
          use_gpu: settings.useGpu
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error('Failed to solve problem');
      }

      const data: SolverResult = await response.json();
      setResult(data);
      
      if (onSolutionFound) {
        onSolutionFound(data);
      }

      toast.success(`Answer found: ${data.answer}`);
    } catch (error: any) {
      console.error('Error solving problem:', error);
      toast.error('Error solving problem. Please check if the backend is running.');
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const loadSampleProblem = (sample: typeof sampleProblems[0]) => {
    setProblem(sample.problem);
    setResult(null);
    toast.info(`Loaded: ${sample.title}`);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="bg-background/50 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-nexus-primary-bright" />
            <CardTitle className="text-lg">AIMO3 Competition Solver</CardTitle>
          </div>
          <CardDescription>
            AI-powered mathematical olympiad problem solver with chain-of-thought reasoning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="solver" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="solver">Solver</TabsTrigger>
              <TabsTrigger value="samples">Sample Problems</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="solver" className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Enter your math problem (LaTeX supported):
                </label>
                <Textarea
                  placeholder="e.g., What is the remainder when 2^100 is divided by 7?"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="min-h-[120px] bg-background/50 border-white/10"
                />
              </div>

              <Button 
                onClick={solveProblem} 
                disabled={isLoading || !problem.trim()}
                className="w-full bg-nexus-primary hover:bg-nexus-primary-bright"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Solving...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Solve Problem
                  </>
                )}
              </Button>

              {isLoading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Generating solutions and applying majority voting...
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="samples" className="space-y-2">
              {sampleProblems.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 border-white/10"
                  onClick={() => loadSampleProblem(sample)}
                >
                  <div>
                    <div className="font-medium">{sample.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {sample.problem}
                    </div>
                  </div>
                </Button>
              ))}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Number of Solution Samples
                </label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={settings.numSamples}
                  onChange={(e) => setSettings(prev => ({ ...prev, numSamples: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 (Fast)</span>
                  <span className="font-bold">{settings.numSamples}</span>
                  <span>16 (Accurate)</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Time Budget (seconds)
                </label>
                <input
                  type="range"
                  min="30"
                  max="300"
                  step="30"
                  value={settings.timeBudget}
                  onChange={(e) => setSettings(prev => ({ ...prev, timeBudget: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>30s</span>
                  <span className="font-bold">{settings.timeBudget}s</span>
                  <span>300s</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useGpu"
                  checked={settings.useGpu}
                  onChange={(e) => setSettings(prev => ({ ...prev, useGpu: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="useGpu" className="text-sm">
                  Use GPU Model (requires CUDA)
                </label>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card className="bg-background/50 border-white/10 flex-1 overflow-auto">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.confidence >= 0.7 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : result.confidence >= 0.4 ? (
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <CardTitle className="text-lg">Solution Found</CardTitle>
              </div>
              <Badge variant={result.confidence >= 0.7 ? "default" : "secondary"}>
                {(result.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Answer */}
            <div className="p-4 bg-nexus-primary/20 rounded-lg border border-nexus-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-nexus-primary-bright" />
                <span className="text-sm text-muted-foreground">Final Answer</span>
              </div>
              <div className="text-4xl font-bold text-nexus-primary-bright">
                {result.answer}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Zap className="w-3 h-3" />
                  Method
                </div>
                <div className="text-sm font-medium">{result.method}</div>
              </div>
              {result.total_time && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                    Time
                  </div>
                  <div className="text-sm font-medium">{result.total_time.toFixed(1)}s</div>
                </div>
              )}
              {result.num_attempts && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <BarChart3 className="w-3 h-3" />
                    Attempts
                  </div>
                  <div className="text-sm font-medium">{result.num_attempts}</div>
                </div>
              )}
            </div>

            {/* Solution */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">Solution:</div>
              <div className="p-3 bg-white/5 rounded-lg text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
                {result.solution}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIMO3Solver;
