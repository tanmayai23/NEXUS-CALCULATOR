
import React, { useState } from 'react';
import { CalculatorIcon, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

interface NexusInputProps {
  onFormulaSubmit: (formula: string) => void;
  onClear: () => void;
}

const NexusInput: React.FC<NexusInputProps> = ({ onFormulaSubmit, onClear }) => {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onFormulaSubmit(inputValue);
      toast.success("Formula processed", {
        description: "Answer card updated successfully"
      });
    }
  };
  
  const handleClear = () => {
    setInputValue('');
    onClear();
  };
  
  const handleVoiceInput = () => {
    setIsListening(prev => !prev);
    
    // This would integrate with Web Speech API or similar
    // For now we'll just simulate voice recognition
    if (!isListening) {
      toast("Listening for voice input...");
      setTimeout(() => {
        setIsListening(false);
        setInputValue('f(x) = sin(x) + cos(2x)');
        toast.success("Voice input captured");
      }, 2000);
    }
  };

  const suggestedFormulas = [
    "f(x) = sin(x)",
    "f(x) = x² + 2x - 1",
    "f(x, y) = x² + y²",
    "f(x) = e^x * cos(x)"
  ];

  const handleSuggestionClick = (formula: string) => {
    setInputValue(formula);
  };
  
  return (
    <div className="w-full px-2">
      <form onSubmit={handleSubmit} className="nexus-panel p-2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CalculatorIcon className="text-nexus-primary-bright w-6 h-6" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your question or expression..."
            className="nexus-input flex-1"
          />
          <Button
            type="button"
            onClick={handleVoiceInput}
            variant="ghost"
            size="icon"
            className={`rounded-full ${isListening ? 'bg-red-500/20 text-red-500' : 'hover:bg-white/10'}`}
          >
            <Sparkles className="w-4 h-4" />
          </Button>
          {inputValue && (
            <Button
              type="button"
              onClick={handleClear}
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button type="submit" className="bg-nexus-primary-bright hover:bg-nexus-primary-bright/80">
            <Send className="w-4 h-4 mr-2" />
            Solve Question
          </Button>
        </div>
        
        {/* Suggested formulas */}
        <div className="flex flex-wrap gap-2 mt-1">
          {suggestedFormulas.map((formula) => (
            <button
              key={formula}
              type="button"
              onClick={() => handleSuggestionClick(formula)}
              className="text-xs py-1 px-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            >
              {formula}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default NexusInput;
