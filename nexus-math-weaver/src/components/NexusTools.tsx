
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, 
  Calculator, 
  Fingerprint, 
  LineChart, 
  Layers, 
  Map, 
  Share2, 
  Lightbulb
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';

interface NexusToolsProps {
  onToolSelect: (tool: string) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

const categories = [
  { id: 'calculation', name: 'Calculation', icon: Calculator },
  { id: 'visualization', name: 'Visualization', icon: LineChart },
  { id: 'class9', name: 'Class 9 Visuals', icon: Map },
  { id: 'quantum', name: 'Quantum', icon: BrainCircuit },
  { id: 'dimensions', name: 'Dimensions', icon: Layers },
  { id: 'neural', name: 'Neural Math', icon: Fingerprint },
];

const NexusTools: React.FC<NexusToolsProps> = ({ 
  onToolSelect, 
  activeCategory,
  setActiveCategory
}) => {
  // Handle tool selection
  const handleToolClick = (tool: string) => {
    onToolSelect(tool);
    toast.info(`${tool} tool activated`);
  };
  
  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
  };
  
  return (
    <div className="nexus-panel h-full flex flex-col">
      {/* Tools header */}
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <Lightbulb className="text-nexus-primary-bright w-5 h-5" />
        <h3 className="font-medium">Tools</h3>
      </div>
      
      {/* Category selector */}
      <div className="flex overflow-x-auto p-2 border-b border-white/10 gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant="ghost"
            size="sm"
            onClick={() => handleCategoryChange(category.id)}
            className={`rounded-md whitespace-nowrap ${activeCategory === category.id ? 'bg-white/20' : ''}`}
          >
            <category.icon className="w-4 h-4 mr-2" />
            {category.name}
          </Button>
        ))}
      </div>
      
      {/* Tools grid based on active category */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {activeCategory === 'calculation' && (
            <>
              <ToolButton 
                icon={Calculator} 
                label="Standard"
                onClick={() => handleToolClick('Standard Calculator')}  
              />
              <ToolButton 
                icon={LineChart} 
                label="Function"
                onClick={() => handleToolClick('Function Calculator')}
              />
              <ToolButton 
                icon={Map} 
                label="Spatial"
                onClick={() => handleToolClick('Spatial Calculator')}
              />
              <ToolButton 
                icon={Share2} 
                label="Network"
                onClick={() => handleToolClick('Network Calculator')}
              />
            </>
          )}
          
          {activeCategory === 'visualization' && (
            <>
              <ToolButton 
                icon={LineChart} 
                label="2D Graph"
                onClick={() => handleToolClick('2D Graph')}
              />
              <ToolButton 
                icon={Layers} 
                label="3D Surface"
                onClick={() => handleToolClick('3D Surface')}
              />
              <ToolButton 
                icon={Map} 
                label="Topology"
                onClick={() => handleToolClick('Topology Map')}
              />
              <ToolButton 
                icon={BrainCircuit} 
                label="Neural"
                onClick={() => handleToolClick('Neural Visualization')}
              />
            </>
          )}

          {activeCategory === 'class9' && (
            <>
              <ToolButton
                icon={Map}
                label="Coordinate Plotter"
                onClick={() => handleToolClick('Class 9 Coordinate Plotter')}
              />
              <ToolButton
                icon={Share2}
                label="Lines and Angles"
                onClick={() => handleToolClick('Lines and Angles Explorer')}
              />
              <ToolButton
                icon={Layers}
                label="Triangles Proof"
                onClick={() => handleToolClick('Triangles Congruence Proof')}
              />
              <ToolButton
                icon={BrainCircuit}
                label="Circle Chords"
                onClick={() => handleToolClick('Circle Chord Animator')}
              />
              <ToolButton
                icon={Calculator}
                label="Surface and Volume"
                onClick={() => handleToolClick('Surface Volume 3D Net')}
              />
            </>
          )}
          
          {activeCategory === 'quantum' && (
            <>
              <ToolButton 
                icon={BrainCircuit} 
                label="Wave Function"
                onClick={() => handleToolClick('Wave Function')}
              />
              <ToolButton 
                icon={Share2} 
                label="Entanglement"
                onClick={() => handleToolClick('Entanglement')}
              />
              <ToolButton 
                icon={Calculator} 
                label="QBit Matrix"
                onClick={() => handleToolClick('QBit Matrix')}
              />
              <ToolButton 
                icon={Lightbulb} 
                label="Superposition"
                onClick={() => handleToolClick('Superposition')}
              />
            </>
          )}
          
          {activeCategory === 'dimensions' && (
            <>
              <ToolButton 
                icon={Layers} 
                label="4D Tesseract"
                onClick={() => handleToolClick('4D Tesseract')}
              />
              <ToolButton 
                icon={Map} 
                label="Fractal Space"
                onClick={() => handleToolClick('Fractal Space')}
              />
              <ToolButton 
                icon={BrainCircuit} 
                label="Hyperspace"
                onClick={() => handleToolClick('Hyperspace')}
              />
              <ToolButton 
                icon={Share2} 
                label="Dimensional Bridge"
                onClick={() => handleToolClick('Dimensional Bridge')}
              />
            </>
          )}
          
          {activeCategory === 'neural' && (
            <>
              <ToolButton 
                icon={Fingerprint} 
                label="Thought Pattern"
                onClick={() => handleToolClick('Thought Pattern')}
              />
              <ToolButton 
                icon={BrainCircuit} 
                label="Neural Net"
                onClick={() => handleToolClick('Neural Net')}
              />
              <ToolButton 
                icon={Lightbulb} 
                label="Insight Generator"
                onClick={() => handleToolClick('Insight Generator')}
              />
              <ToolButton 
                icon={Map} 
                label="Mind Map"
                onClick={() => handleToolClick('Mind Map')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface ToolButtonProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon: Icon, label, onClick }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          className="flex flex-col items-center justify-center h-24 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          onClick={onClick}
        >
          <Icon className="h-8 w-8 mb-2 text-nexus-primary-bright" />
          <span className="text-xs">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label} Tool</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default NexusTools;
