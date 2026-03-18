
import React, { useState } from 'react';

import NexusCanvas from './NexusCanvas';
import NexusInput from './NexusInput';
import NexusAssistant from './NexusAssistant';
import NexusTools from './NexusTools';
import AIMO3Solver from './AIMO3Solver';
import NexusLearningCoach from './NexusLearningCoach';
import { BrainCircuit, Menu, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

interface AnswerCardData {
  question: string;
  finalAnswer: string;
  keyFormula: string;
  steps: string[];
  mistakeAlerts: string[];
  solverModeLabel: 'Basic' | 'Board' | 'Competitive';
  tier: 'tier1' | 'tier2' | 'tier3';
  route: string;
  estimatedSolveDepth: string;
}

interface AutoSolveResponse {
  tier: 'tier1' | 'tier2' | 'tier3';
  route: string;
  estimatedSolveDepth: string;
  answer: string | number;
  solution?: string;
  confidence?: number;
  error?: string;
}

const NexusLayout: React.FC = () => {
  const [activeFormula, setActiveFormula] = useState<string>('');
  const [activeVisualization, setActiveVisualization] = useState<string>('default');
  const [visualCue, setVisualCue] = useState<string>('');
  const [showTools, setShowTools] = useState(false);
  const [showAIMO3, setShowAIMO3] = useState(false);
  const [activeView, setActiveView] = useState<'solve' | 'coach' | 'advanced'>('solve');
  const [activeTool, setActiveTool] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState('calculation');
  const [formulaResult, setFormulaResult] = useState<string | number | null>(null);
  const [answerCard, setAnswerCard] = useState<AnswerCardData | null>(null);
  const [showVisualization, setShowVisualization] = useState(true);

  const getSolverModeLabel = (tier: AutoSolveResponse['tier']): 'Basic' | 'Board' | 'Competitive' => {
    if (tier === 'tier1') return 'Basic';
    if (tier === 'tier2') return 'Board';
    return 'Competitive';
  };

  const buildAnswerCard = (formula: string, result: string | number, metadata: AutoSolveResponse): AnswerCardData => {
    const alerts: string[] = [];
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      alerts.push('Parentheses may be unbalanced. Recheck grouping.');
    }
    if (/\/{2,}|\+{2,}|\-{2,}/.test(formula)) {
      alerts.push('Possible operator typing mistake detected.');
    }

    return {
      question: formula,
      finalAnswer: String(result),
      keyFormula: formula,
      steps: [
        'Detect question complexity and assign difficulty tier.',
        metadata.route === 'calculator-engine'
          ? 'Route to fast calculator/simplification engine.'
          : 'Route to AI solver for multi-step reasoning.',
        (metadata.solution && metadata.solution.trim())
          ? metadata.solution
          : 'Generate final answer and confidence signal.',
      ],
      mistakeAlerts: alerts,
      solverModeLabel: getSolverModeLabel(metadata.tier),
      tier: metadata.tier,
      route: metadata.route,
      estimatedSolveDepth: metadata.estimatedSolveDepth,
    };
  };

  const awardCalculatorUsage = async () => {
    const studentId = localStorage.getItem('nexus-student-profile-id-v1');
    const studentToken = localStorage.getItem('nexus-student-token-v1');
    if (!studentId || !studentToken) return;

    try {
      await fetch(`http://localhost:3001/api/students/${studentId}/activity/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-student-token': studentToken,
        },
        body: JSON.stringify({ activityType: 'calculator', count: 1 }),
      });

      // Notify coach panels that a question was checked so they can refresh API-backed state.
      window.dispatchEvent(new CustomEvent('nexus:learning-refresh'));
    } catch (error) {
      console.error('Could not award calculator usage score:', error);
    }
  };
  
  const handleFormulaSubmit = async (formula: string) => {
    setActiveFormula(formula);
    const normalized = formula.toLowerCase();

    if (normalized.includes('slope') || normalized.includes('m=')) {
      setVisualCue('slope-increase');
      setActiveVisualization('class9-coordinate');
    } else if (normalized.includes('parallel') || normalized.includes('transversal')) {
      setVisualCue('parallel-angles');
      setActiveVisualization('class9-lines-angles');
    } else if (normalized.includes('congruent') || normalized.includes('triangle')) {
      setVisualCue('congruence');
      setActiveVisualization('class9-triangles');
    } else if (normalized.includes('chord') || normalized.includes('radius') || normalized.includes('circle')) {
      setVisualCue('chord-theorem');
      setActiveVisualization('class9-circles');
    } else if (normalized.includes('volume') || normalized.includes('surface area')) {
      setVisualCue('net-to-solid');
      setActiveVisualization('class9-surface-volume');
    } else {
      setVisualCue('');
    }

    try {
      const response = await fetch('http://localhost:3001/api/solve/auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: formula }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error evaluating formula');
      }

      const data: AutoSolveResponse = await response.json();
      console.log('Processing formula:', formula, 'Result:', data.answer);
      setFormulaResult(data.answer);
      setAnswerCard(buildAnswerCard(formula, data.answer, data));
      toast.success(`Result: ${data.answer}`);
      await awardCalculatorUsage();
    } catch (error: any) {
      console.error('Error evaluating formula:', error);
      setFormulaResult(null); // Clear result on error
      setAnswerCard(null);
      toast.error(error.message || 'Error evaluating formula. Please check the syntax.');
    }
  };
  
  const handleClear = () => {
    setActiveFormula('');
    setActiveVisualization('default');
    setVisualCue('');
    setFormulaResult(null); // Clear result on clear
    setAnswerCard(null);
    toast.info("Canvas cleared");
  };
  
  const handleToolSelect = (tool: string) => {
    setActiveTool(tool);
    
    if (tool === 'Class 9 Coordinate Plotter') {
      setActiveVisualization('class9-coordinate');
      setVisualCue('point-plot');
    } else if (tool === 'Lines and Angles Explorer') {
      setActiveVisualization('class9-lines-angles');
      setVisualCue('parallel-angles');
    } else if (tool === 'Triangles Congruence Proof') {
      setActiveVisualization('class9-triangles');
      setVisualCue('congruence');
    } else if (tool === 'Circle Chord Animator') {
      setActiveVisualization('class9-circles');
      setVisualCue('chord-theorem');
    } else if (tool === 'Surface Volume 3D Net') {
      setActiveVisualization('class9-surface-volume');
      setVisualCue('net-to-solid');
    } else if (tool === '2D Graph' || tool === 'Function Calculator') {
      setActiveVisualization('numeric');
      setVisualCue('slope-increase');
    } else if (tool === 'Wave Function' || tool === 'Superposition') {
      setActiveVisualization('quantum');
      setVisualCue('');
    }
    
    console.log('Selected tool:', tool);
  };
  
  const toggleTools = () => {
    setShowTools(prev => !prev);
    if (!showTools) setShowAIMO3(false);
  };

  const toggleAIMO3 = () => {
    setShowAIMO3(prev => !prev);
    if (!showAIMO3) setShowTools(false);
  };
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden sacred-pattern">
      {/* Header */}
      <header className="border-b border-white/10 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-nexus-primary-bright" />
          <h1 className="text-2xl font-bold nexus-text">NEXUS</h1>
          <span className="px-2 py-0.5 bg-nexus-primary-bright/20 text-nexus-primary-bright text-xs rounded-full">
            Alpha v0.1
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'solve' ? 'default' : 'outline'}
            className={activeView === 'solve' ? 'bg-nexus-primary-bright text-white' : 'border-white/10 hover:bg-white/10'}
            onClick={() => {
              setActiveView('solve');
              setShowTools(false);
            }}
          >
            Solve Question
          </Button>
          <Button
            variant={activeView === 'coach' ? 'default' : 'outline'}
            className={activeView === 'coach' ? 'bg-nexus-primary-bright text-white' : 'border-white/10 hover:bg-white/10'}
            onClick={() => {
              setActiveView('coach');
              setShowTools(false);
            }}
          >
            Chapter Coach
          </Button>
          <Button
            variant={activeView === 'advanced' ? 'default' : 'outline'}
            className={activeView === 'advanced' ? 'bg-nexus-primary-bright text-white' : 'border-white/10 hover:bg-white/10'}
            onClick={() => setActiveView('advanced')}
          >
            Advanced
          </Button>

          <Button
            variant="outline"
            className={`border-white/10 hover:bg-white/10 ${showAIMO3 ? 'bg-nexus-primary/20 text-nexus-primary-bright' : ''}`}
            onClick={toggleAIMO3}
          >
            <Trophy className="w-4 h-4 mr-2" />
            {showAIMO3 ? 'Hide AIMO3' : 'AIMO3 Solver'}
          </Button>
          <Button
            variant="outline"
            className="border-white/10 hover:bg-white/10"
            onClick={toggleTools}
            disabled={activeView !== 'advanced'}
          >
            <Menu className="w-4 h-4 mr-2" />
            {showTools ? 'Hide Tools' : 'Show Tools'}
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left panel - Tools (conditionally shown) */}
        {activeView === 'advanced' && showTools && (
          <div className="w-64 h-full">
            <NexusTools 
              onToolSelect={handleToolSelect} 
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
            />
          </div>
        )}

        {/* Left panel - AIMO3 Solver (conditionally shown) */}
        {showAIMO3 && (
          <div className="w-96 h-full overflow-auto">
            <AIMO3Solver 
              onSolutionFound={(result) => {
                setFormulaResult(result.answer);
                setActiveFormula(`AIMO3 Answer: ${result.answer}`);
              }}
            />
          </div>
        )}
        
        {/* Center panel - Visualization */}
        <div className="flex-1 flex flex-col gap-4">
          {activeView === 'coach' ? (
            <div className="flex-1 nexus-panel overflow-hidden">
              <NexusLearningCoach />
            </div>
          ) : (
            <>
              <div className="nexus-panel p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Answer Panel</h3>
                  <Button variant="outline" onClick={() => setShowVisualization((prev) => !prev)}>
                    {showVisualization ? 'Hide Visualization' : 'Show Visualization'}
                  </Button>
                </div>

                {!answerCard ? (
                  <p className="text-sm text-white/70">Enter a question/expression to get final answer, steps, and formula.</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-white/60">Question</p>
                      <p className="text-white/90">{answerCard.question}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Final Answer</p>
                      <p className="text-xl font-bold text-nexus-primary-bright">{answerCard.finalAnswer}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="bg-white/5 rounded p-2 border border-white/10">
                        <p className="text-white/60 text-xs">Solver Mode</p>
                        <p className="text-white/90 font-semibold">{answerCard.solverModeLabel}</p>
                        <p className="text-white/50 text-[11px] uppercase">{answerCard.tier}</p>
                      </div>
                      <div className="bg-white/5 rounded p-2 border border-white/10">
                        <p className="text-white/60 text-xs">Solve Route</p>
                        <p className="text-white/90 font-semibold">{answerCard.route}</p>
                      </div>
                      <div className="bg-white/5 rounded p-2 border border-white/10">
                        <p className="text-white/60 text-xs">Estimated Solve Depth</p>
                        <p className="text-white/90 font-semibold">{answerCard.estimatedSolveDepth}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/60">Key Formula Used</p>
                      <p className="text-white/90">{answerCard.keyFormula}</p>
                    </div>
                    <div>
                      <p className="text-white/60 mb-1">Step-by-step Reasoning</p>
                      <ol className="list-decimal pl-5 text-white/85 space-y-1">
                        {answerCard.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    {answerCard.mistakeAlerts.length > 0 && (
                      <div>
                        <p className="text-white/60 mb-1">Mistake Alerts</p>
                        <ul className="list-disc pl-5 text-yellow-200 space-y-1">
                          {answerCard.mistakeAlerts.map((alert) => (
                            <li key={alert}>{alert}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showVisualization && (
                <div className="flex-1 nexus-panel overflow-hidden">
                  <NexusCanvas
                    formula={activeFormula}
                    visualization={activeVisualization}
                    visualCue={visualCue}
                  />
                </div>
              )}
            </>
          )}
          
          {activeView !== 'coach' && (
            <NexusInput 
              onFormulaSubmit={handleFormulaSubmit}
              onClear={handleClear}
            />
          )}
        </div>
        
        {/* Right panel - Assistant */}
        <div className="w-80 h-full">
          <NexusAssistant 
            formula={activeFormula}
            formulaResult={formulaResult}
          />
        </div>
      </div>
      
      {/* Floating particles for decoration */}
      <div className="particle w-2 h-2 top-1/4 left-1/4 animate-delay-100"></div>
      <div className="particle w-1 h-1 top-1/3 right-1/4 animate-delay-300"></div>
      <div className="particle w-3 h-3 bottom-1/4 left-1/3 animate-delay-200"></div>
      <div className="particle w-2 h-2 top-2/3 right-1/3 animate-delay-500"></div>
    </div>
  );
};

export default NexusLayout;
