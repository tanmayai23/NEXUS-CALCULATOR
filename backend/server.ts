import express, { Request, Response } from 'express';
import cors from 'cors';
import { evaluate } from 'mathjs';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Nexus Math Weaver Backend is running!');
});

// Basic calculator endpoint
app.post('/calculate', (req: Request, res: Response) => {
  const { expression } = req.body;

  if (!expression) {
    return res.status(400).json({ error: 'Expression is required' });
  }

  try {
    const result = evaluate(expression);
    res.json({ result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// AIMO3 Competition Solver Endpoint
app.post('/api/aimo3/solve', async (req: Request, res: Response) => {
  const { problem, num_samples = 4, time_budget = 120 } = req.body;

  if (!problem) {
    return res.status(400).json({ error: 'Problem is required' });
  }

  try {
    // Call Python solver script
    const pythonScript = path.join(__dirname, '..', 'aimo3', 'api', 'solve.py');
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--problem', problem,
      '--num_samples', num_samples.toString(),
      '--time_budget', time_budget.toString()
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          res.json(result);
        } catch (e) {
          res.json({ 
            answer: parseInt(output.trim()) || 0,
            solution: output,
            confidence: 0.5
          });
        }
      } else {
        res.status(500).json({ 
          error: 'Solver failed', 
          details: errorOutput 
        });
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check for AIMO3 model
app.get('/api/aimo3/status', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    model: 'AIMO3 Math Solver',
    version: '1.0.0',
    capabilities: [
      'chain-of-thought',
      'multi-sample-reasoning',
      'majority-voting',
      'solution-verification'
    ]
  });
});

// Get available models
app.get('/api/aimo3/models', (req: Request, res: Response) => {
  res.json({
    models: [
      {
        id: 'qwen-math-7b',
        name: 'Qwen2.5-Math-7B-Instruct',
        description: 'Fast, good for testing',
        vram: '8GB'
      },
      {
        id: 'qwen-math-72b',
        name: 'Qwen2.5-Math-72B-Instruct',
        description: 'Best performance, requires high VRAM',
        vram: '48GB'
      },
      {
        id: 'deepseek-math',
        name: 'DeepSeek-Math-7B-Instruct',
        description: 'Math-specialized model',
        vram: '8GB'
      }
    ]
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});