
import React, { useState } from 'react';

import NexusCanvas from './NexusCanvas';
import NexusInput from './NexusInput';
import NexusAssistant from './NexusAssistant';
import NexusTools from './NexusTools';
import AIMO3Solver from './AIMO3Solver';
import { BrainCircuit, Menu, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

const NexusLayout: React.FC = () => {
  const [activeFormula, setActiveFormula] = useState<string>('');
  const [activeVisualization, setActiveVisualization] = useState<string>('default');
  const [showTools, setShowTools] = useState(false);
  const [showAIMO3, setShowAIMO3] = useState(false);
  const [activeTool, setActiveTool] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState('calculation');
  const [formulaResult, setFormulaResult] = useState<string | number | null>(null);
  
  const handleFormulaSubmit = async (formula: string) => {
    setActiveFormula(formula);
    try {
      const response = await fetch('http://localhost:3001/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expression: formula }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error evaluating formula');
      }

      const data = await response.json();
      console.log('Processing formula:', formula, 'Result:', data.result);
      setFormulaResult(data.result);
      toast.success(`Result: ${data.result}`);
    } catch (error: any) {
      console.error('Error evaluating formula:', error);
      setFormulaResult(null); // Clear result on error
      toast.error(error.message || 'Error evaluating formula. Please check the syntax.');
    }
  };
  
  const handleClear = () => {
    setActiveFormula('');
    setActiveVisualization('default');
    setFormulaResult(null); // Clear result on clear
    toast.info("Canvas cleared");
  };
  
  const handleToolSelect = (tool: string) => {
    setActiveTool(tool);
    
    // Some tools would change the visualization type
    if (tool === 'Wave Function' || tool === 'Superposition') {
      setActiveVisualization('quantum');
    } else if (tool === '2D Graph' || tool === 'Function Calculator') {
      setActiveVisualization('numeric');
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
          >
            <Menu className="w-4 h-4 mr-2" />
            {showTools ? 'Hide Tools' : 'Show Tools'}
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left panel - Tools (conditionally shown) */}
        {showTools && (
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
          <div className="flex-1 nexus-panel overflow-hidden">
            <NexusCanvas 
              formula={activeFormula}
              visualization={activeVisualization}
            />
          </div>
          
          <NexusInput 
            onFormulaSubmit={handleFormulaSubmit}
            onClear={handleClear}
          />
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
