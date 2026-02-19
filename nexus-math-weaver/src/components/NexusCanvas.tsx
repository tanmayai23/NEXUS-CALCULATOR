
import React, { useRef, useEffect } from 'react';
import { Wand2 } from 'lucide-react';

interface NexusCanvasProps {
  formula?: string;
  visualization?: string;
}

const NexusCanvas: React.FC<NexusCanvasProps> = ({ formula, visualization }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Make canvas responsive
    const resizeCanvas = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        drawVisualization(ctx, canvas.width, canvas.height, formula, visualization);
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [formula, visualization]);
  
  // Draw visualization based on formula and visualization type
  const drawVisualization = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    formula?: string, 
    visualization?: string
  ) => {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw default visualization if no specific one is provided
    if (!formula || !visualization) {
      drawDefaultVisualization(ctx, width, height);
      return;
    }
    
    // Add different visualization types here
    switch(visualization) {
      case 'quantum':
        drawQuantumVisualization(ctx, width, height, formula);
        break;
      case 'numeric':
        drawNumericVisualization(ctx, width, height, formula);
        break;
      default:
        drawDefaultVisualization(ctx, width, height);
    }
  };
  
  // Default cosmic space visualization
  const drawDefaultVisualization = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Create gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0D0D6F');
    bgGradient.addColorStop(1, '#3E00FF');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add particles
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 2 + 0.5;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.7})`;
      ctx.fill();
    }
    
    // Add fluid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      ctx.moveTo(startX, startY);
      
      // Create curved path
      for (let j = 0; j < 5; j++) {
        const cpX1 = startX + Math.random() * 100 - 50;
        const cpY1 = startY + Math.random() * 100 - 50;
        const cpX2 = startX + Math.random() * 100 - 50;
        const cpY2 = startY + Math.random() * 100 - 50;
        const endX = startX + Math.random() * 100 - 50;
        const endY = startY + Math.random() * 100 - 50;
        
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, endX, endY);
      }
      
      ctx.stroke();
    }
    
    // Add central glow
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.2;
    
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    glowGradient.addColorStop(0, 'rgba(126, 87, 194, 0.8)');
    glowGradient.addColorStop(0.5, 'rgba(126, 87, 194, 0.2)');
    glowGradient.addColorStop(1, 'rgba(126, 87, 194, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  
  // Specialized visualizations
  const drawQuantumVisualization = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    formula: string
  ) => {
    // Quantum-themed visualization
    // Would implement quantum wave function visualization here
    drawDefaultVisualization(ctx, width, height);
  };
  
  const drawNumericVisualization = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    formula: string
  ) => {
    // Numeric-themed visualization
    // Would implement numeric pattern visualization here
    drawDefaultVisualization(ctx, width, height);
  };
  
  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-xl">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
      
      {!formula && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
          <Wand2 className="w-12 h-12 mb-4 animate-pulse-soft" />
          <p className="text-lg font-light">Enter a formula to visualize</p>
        </div>
      )}
      
      {/* Floating particles for decoration */}
      <div className="particle w-2 h-2 top-1/4 left-1/4 animate-delay-100"></div>
      <div className="particle w-1 h-1 top-1/3 right-1/4 animate-delay-300"></div>
      <div className="particle w-3 h-3 bottom-1/4 left-1/3 animate-delay-200"></div>
      <div className="particle w-2 h-2 top-2/3 right-1/3 animate-delay-500"></div>
    </div>
  );
};

export default NexusCanvas;
