
import React, { useState, useEffect } from 'react';
import { Brain, MessageSquare, User, BrainCircuit } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface NexusAssistantProps {
  formula?: string;
  formulaResult?: string | number | null; // Add this to accept the result
  onAssistantResponse?: (response: string) => void;
}

const NexusAssistant: React.FC<NexusAssistantProps> = ({ formula, formulaResult, onAssistantResponse }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm NEXUS, your mathematical assistant. How can I help you today?",
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isBrainActive, setIsBrainActive] = useState(false);
  
  // Process new formula and generate explanation
  useEffect(() => {
    if (formula) {
      setIsBrainActive(true);
      
      setTimeout(() => {
        const explanation = generateFormulaExplanation(formula, formulaResult);
        
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            content: `Formula processed: ${formula}`,
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: (Date.now() + 1).toString(),
            content: explanation,
            sender: 'assistant',
            timestamp: new Date()
          }
        ]);
        
        if (onAssistantResponse) {
          onAssistantResponse(explanation);
        }
        
        setIsBrainActive(false);
      }, 1500);
    }
  }, [formula, formulaResult]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content: inputValue,
        sender: 'user',
        timestamp: new Date()
      }
    ]);
    
    setIsBrainActive(true);
    setInputValue('');
    
    // Simulate assistant thinking and responding
    setTimeout(() => {
      const response = generateAssistantResponse(inputValue);
      
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'assistant',
          timestamp: new Date()
        }
      ]);
      
      setIsBrainActive(false);
    }, 1500);
  };
  
  const generateFormulaExplanation = (formula: string, result?: string | number | null): string => {
    let response = `Processed formula: "${formula}".`;
    if (result !== undefined && result !== null) {
      response += ` Result: ${result}.`;
    } else {
      response += ` Visualization generated.`;
    }
    return response;
  };

  const generateAssistantResponse = (message: string): string => {
    // In a real implementation, this would integrate with a language model
    // For now, we'll use simple pattern matching
    
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      return `Hello! I'm NEXUS, your mathematical assistant. I can help you visualize and understand mathematical concepts. Try entering a formula like "f(x) = sin(x)" or ask me about different mathematical domains.`;
    } else if (message.toLowerCase().includes('quantum')) {
      return `Quantum mathematics deals with operators in Hilbert spaces, probability amplitudes, and superposition states. To visualize quantum concepts, try entering a wave function formula or specify "visualization: quantum" with your formula.`;
    } else if (message.toLowerCase().includes('matrix') || message.toLowerCase().includes('linear algebra')) {
      return `Linear algebra is a powerful framework for solving systems of equations and geometric transformations. I can help visualize matrices, eigenvalues, and vector spaces. Try entering a matrix operation or transformation formula.`;
    } else if (message.toLowerCase().includes('help') || message.toLowerCase().includes('what can you do')) {
      return `I can help with various mathematical tasks including:\n- Visualizing functions and equations\n- Explaining mathematical concepts\n- Processing complex calculations\n- Exploring dimensional spaces\n\nTry entering a formula or asking about a specific mathematical domain.`;
    }
    
    return `I understand you're interested in "${message}". To explore this area mathematically, you could try formulating an equation that represents the key relationships involved, or ask me for specific visualization techniques that might help.`;
  };
  
  return (
    <div className="nexus-panel h-full flex flex-col">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-nexus-primary-bright w-5 h-5" />
          <h3 className="font-medium">NEXUS Assistant</h3>
        </div>
        <div className={cn(
          "h-2 w-2 rounded-full transition-colors",
          isBrainActive ? "bg-nexus-primary-bright animate-pulse" : "bg-green-500"
        )}></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={cn(
              "flex gap-2 max-w-[90%]",
              message.sender === 'user' ? "ml-auto" : "mr-auto"
            )}
          >
            {message.sender === 'assistant' && (
              <Avatar className="w-8 h-8 border border-nexus-primary-bright/50 bg-nexus-primary-bright/20">
                <Brain className="w-4 h-4 text-nexus-primary-bright" />
              </Avatar>
            )}
            
            <div className={cn(
              "rounded-lg p-3",
              message.sender === 'user' 
                ? "bg-nexus-primary-bright text-white ml-2" 
                : "bg-white/10 text-white/90"
            )}>
              <p className="text-sm">{message.content}</p>
            </div>
            
            {message.sender === 'user' && (
              <Avatar className="w-8 h-8 border border-white/30 bg-white/20">
                <User className="w-4 h-4" />
              </Avatar>
            )}
          </div>
        ))}
        
        {isBrainActive && (
          <div className="flex gap-2 max-w-[90%]">
            <Avatar className="w-8 h-8 border border-nexus-primary-bright/50 bg-nexus-primary-bright/20">
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
            placeholder="Ask NEXUS about mathematics..."
            className="nexus-input flex-1"
          />
          <button 
            type="submit" 
            className="nexus-button"
            disabled={isBrainActive}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default NexusAssistant;
