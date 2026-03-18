
import React, { useRef, useEffect } from 'react';
import { Wand2 } from 'lucide-react';

interface NexusCanvasProps {
  formula?: string;
  visualization?: string;
  visualCue?: string;
}

const NexusCanvas: React.FC<NexusCanvasProps> = ({ formula, visualization, visualCue }) => {
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
        drawVisualization(ctx, canvas.width, canvas.height, formula, visualization, visualCue);
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [formula, visualization, visualCue]);
  
  // Draw visualization based on formula and visualization type
  const drawVisualization = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    formula?: string, 
    visualization?: string,
    cue?: string
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
        drawQuantumVisualization(ctx, width, height);
        break;
      case 'numeric':
        drawNumericVisualization(ctx, width, height, cue);
        break;
      case 'class9-coordinate':
        drawCoordinateVisualization(ctx, width, height, cue);
        break;
      case 'class9-lines-angles':
        drawLinesAnglesVisualization(ctx, width, height, cue);
        break;
      case 'class9-triangles':
        drawTrianglesVisualization(ctx, width, height, cue);
        break;
      case 'class9-circles':
        drawCircleChordVisualization(ctx, width, height, cue);
        break;
      case 'class9-surface-volume':
        drawSurfaceVolumeVisualization(ctx, width, height, cue);
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
    
    // Add stable particles
    for (let i = 0; i < 70; i++) {
      const x = (i * 73) % width;
      const y = (i * 41) % height;
      const radius = (i % 4) * 0.4 + 0.6;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + (i % 5) * 0.1})`;
      ctx.fill();
    }
    
    // Add fluid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const startX = (i + 1) * (width / 5);
      const startY = (i % 2 === 0 ? height * 0.3 : height * 0.65);
      ctx.moveTo(startX, startY);
      
      // Create curved path
      for (let j = 0; j < 3; j++) {
        const shift = 40 + j * 15;
        const cpX1 = startX + shift;
        const cpY1 = startY - shift / 2;
        const cpX2 = startX - shift;
        const cpY2 = startY + shift / 2;
        const endX = startX + shift / 2;
        const endY = startY + (j % 2 === 0 ? -18 : 18);
        
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
    height: number
  ) => {
    drawDefaultVisualization(ctx, width, height);
    ctx.strokeStyle = 'rgba(158, 245, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = height / 2 + Math.sin(x * 0.02) * 45;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  
  const drawNumericVisualization = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    cue?: string
  ) => {
    drawCoordinateGrid(ctx, width, height);

    ctx.strokeStyle = '#8AF7C7';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let px = 0; px <= width; px += 2) {
      const x = (px - width / 2) / 30;
      const y = 0.1 * x * x - 1.5;
      const py = height / 2 - y * 30;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (cue === 'slope-increase') {
      ctx.fillStyle = 'rgba(255, 223, 120, 0.9)';
      ctx.beginPath();
      ctx.arc(width * 0.7, height * 0.33, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE79A';
      ctx.font = '14px sans-serif';
      ctx.fillText('Slope increasing here', width * 0.72, height * 0.3);
    }
  };

  const drawCoordinateGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0B1735';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const drawCoordinateVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cue?: string
  ) => {
    drawCoordinateGrid(ctx, width, height);

    const points = [
      { x: -4, y: 2, label: 'A' },
      { x: 2, y: 3, label: 'B' },
      { x: 3, y: -2, label: 'C' },
    ];

    points.forEach((p) => {
      const px = width / 2 + p.x * 35;
      const py = height / 2 - p.y * 35;
      ctx.fillStyle = '#5AF2A6';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#DDF9ED';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${p.label}(${p.x},${p.y})`, px + 8, py - 8);
    });

    if (cue === 'point-plot' || cue === 'slope-increase') {
      ctx.strokeStyle = '#FFD46E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width / 2 + points[0].x * 35, height / 2 - points[0].y * 35);
      ctx.lineTo(width / 2 + points[1].x * 35, height / 2 - points[1].y * 35);
      ctx.stroke();
      ctx.fillStyle = '#FFD46E';
      ctx.fillText('Line AB: observe slope change', width * 0.56, height * 0.18);
    }
  };

  const drawLinesAnglesVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cue?: string
  ) => {
    ctx.fillStyle = '#121832';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#86D7FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.32);
    ctx.lineTo(width * 0.9, height * 0.32);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.68);
    ctx.lineTo(width * 0.9, height * 0.68);
    ctx.stroke();

    ctx.strokeStyle = '#FFD084';
    ctx.beginPath();
    ctx.moveTo(width * 0.25, height * 0.08);
    ctx.lineTo(width * 0.7, height * 0.94);
    ctx.stroke();

    if (cue === 'parallel-angles') {
      ctx.fillStyle = 'rgba(144, 255, 196, 0.35)';
      ctx.beginPath();
      ctx.arc(width * 0.39, height * 0.32, 28, 0.15, 1.0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(width * 0.58, height * 0.68, 28, 3.35, 4.2);
      ctx.fill();

      ctx.fillStyle = '#D2FFE7';
      ctx.font = '14px sans-serif';
      ctx.fillText('Corresponding angles highlighted', width * 0.54, height * 0.2);
    }
  };

  const drawTrianglesVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cue?: string
  ) => {
    ctx.fillStyle = '#141E3E';
    ctx.fillRect(0, 0, width, height);

    const t1 = [
      { x: width * 0.22, y: height * 0.72 },
      { x: width * 0.38, y: height * 0.28 },
      { x: width * 0.52, y: height * 0.72 },
    ];
    const t2 = [
      { x: width * 0.55, y: height * 0.72 },
      { x: width * 0.71, y: height * 0.28 },
      { x: width * 0.85, y: height * 0.72 },
    ];

    const drawTri = (pts: { x: number; y: number }[], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.stroke();
    };

    drawTri(t1, '#8EE7FF');
    drawTri(t2, '#8EE7FF');

    if (cue === 'congruence') {
      ctx.fillStyle = '#FFE68C';
      ctx.font = '15px sans-serif';
      ctx.fillText('SSA is not valid. SSS / SAS / ASA / RHS valid.', width * 0.22, height * 0.16);

      ctx.fillStyle = 'rgba(255, 230, 140, 0.35)';
      ctx.fillRect(width * 0.28, height * 0.49, 10, 10);
      ctx.fillRect(width * 0.61, height * 0.49, 10, 10);
    }
  };

  const drawCircleChordVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cue?: string
  ) => {
    ctx.fillStyle = '#0F1F38';
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.52;
    const r = Math.min(width, height) * 0.28;

    ctx.strokeStyle = '#9FD3FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const chordY = cy - r * 0.25;
    ctx.strokeStyle = '#89FFC8';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.78, chordY);
    ctx.lineTo(cx + r * 0.78, chordY);
    ctx.stroke();

    ctx.strokeStyle = '#FFD59E';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, chordY);
    ctx.stroke();

    if (cue === 'chord-theorem') {
      ctx.fillStyle = '#FFE2B3';
      ctx.font = '14px sans-serif';
      ctx.fillText('Perpendicular from center bisects chord', width * 0.48, height * 0.18);
      ctx.fillStyle = 'rgba(255, 220, 170, 0.35)';
      ctx.fillRect(cx - 6, chordY - 6, 12, 12);
    }
  };

  const drawSurfaceVolumeVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cue?: string
  ) => {
    ctx.fillStyle = '#152337';
    ctx.fillRect(0, 0, width, height);

    // Cube net on left
    const s = Math.min(width, height) * 0.1;
    const nx = width * 0.18;
    const ny = height * 0.42;
    ctx.strokeStyle = '#8ED4FF';
    ctx.lineWidth = 2;
    const squares = [
      [0, 0], [1, 0], [2, 0], [1, -1], [1, 1], [3, 0]
    ];
    squares.forEach(([dx, dy]) => {
      ctx.strokeRect(nx + dx * s, ny + dy * s, s, s);
    });

    // Isometric cube on right
    const x = width * 0.67;
    const y = height * 0.55;
    const a = Math.min(width, height) * 0.12;
    ctx.strokeStyle = '#9DFFCA';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + a, y - a * 0.55);
    ctx.lineTo(x + a, y + a * 0.45);
    ctx.lineTo(x, y + a);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - a * 0.7, y - a * 0.45);
    ctx.lineTo(x + a * 0.3, y - a);
    ctx.lineTo(x + a, y - a * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + a, y + a * 0.45);
    ctx.lineTo(x + a * 0.3, y);
    ctx.lineTo(x + a * 0.3, y - a);
    ctx.stroke();

    if (cue === 'net-to-solid') {
      ctx.fillStyle = '#FFECA7';
      ctx.font = '14px sans-serif';
      ctx.fillText('Net folds into 3D solid -> connect TSA with volume', width * 0.42, height * 0.2);
      ctx.strokeStyle = 'rgba(255, 236, 167, 0.8)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(nx + s * 4.3, ny + s * 0.5);
      ctx.lineTo(width * 0.57, height * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
  
  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-xl">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
      
      {!formula && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
          <Wand2 className="w-12 h-12 mb-4 animate-pulse-soft" />
          <p className="text-lg font-light">Enter a formula or choose a chapter visual tool</p>
        </div>
      )}

      {visualCue && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-md bg-black/40 text-white/90 text-xs border border-white/20">
          Visual Sync: {visualCue.replace('-', ' ')}
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
