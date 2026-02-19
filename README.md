# NEXUS CALCULATOR - AIMO3 Competition Project

## 🧮 Overview

A comprehensive mathematics platform with integrated AI Mathematical Olympiad (AIMO3) competition solver.

## ✨ Features

### Calculator Features
- Real-time mathematical expression evaluation
- Interactive canvas visualization
- AI-powered assistant
- Multiple calculation tools

### AIMO3 Competition Features
- **Chain-of-Thought Reasoning**: Step-by-step mathematical problem solving
- **Multi-Sample Generation**: Generate multiple solutions for accuracy
- **Majority Voting**: Select the most consistent answer
- **Solution Verification**: Validate mathematical reasoning
- **Test-Time Scaling**: Extended computation for hard problems

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TANMAYKALA/nexus-math-weaver.git
   cd nexus-math-weaver
   ```

2. **Install frontend dependencies**
   ```bash
   cd nexus-math-weaver
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../backend
   npm install
   ```

4. **Install Python ML dependencies (for AIMO3)**
   ```bash
   cd ../aimo3
   pip install -r requirements.txt
   ```

### Running the Project

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend** (in a new terminal)
   ```bash
   cd nexus-math-weaver
   npm run dev
   ```

3. **Open in browser**
   ```
   http://localhost:8080
   ```

## 📁 Project Structure

```
NEXUS CALCULATOR/
├── nexus-math-weaver/     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AIMO3Solver.tsx    # AIMO3 competition UI
│   │   │   ├── NexusLayout.tsx    # Main layout
│   │   │   ├── NexusCanvas.tsx    # Visualization
│   │   │   ├── NexusInput.tsx     # Input component
│   │   │   ├── NexusAssistant.tsx # AI assistant
│   │   │   └── NexusTools.tsx     # Tools panel
│   │   └── ...
│   └── package.json
│
├── backend/               # Node.js/Express backend
│   ├── server.ts          # API server with AIMO3 endpoints
│   └── package.json
│
└── aimo3/                 # Python ML pipeline
    ├── api/               # API integration
    ├── data/              # Data processing
    ├── models/            # Model components
    ├── training/          # Fine-tuning
    ├── kaggle/            # Submission notebooks
    └── requirements.txt
```

## 🏆 AIMO3 Competition

### Using the Solver

1. Click **"AIMO3 Solver"** button in the header
2. Enter your math problem (LaTeX supported)
3. Adjust settings if needed
4. Click **"Solve Problem"**

### Sample Problems

The solver includes sample problems to test:
- Modular arithmetic (2^100 mod 7)
- Sum of integers
- GCD calculations
- Factorials
- Binomial coefficients

### Training Custom Models

See [aimo3/README.md](aimo3/README.md) for detailed training instructions.

## 🛠️ API Endpoints

### Calculator
- `POST /calculate` - Evaluate mathematical expression

### AIMO3
- `POST /api/aimo3/solve` - Solve competition problem
- `GET /api/aimo3/status` - Check solver status
- `GET /api/aimo3/models` - List available models

## 📊 Competition Strategy

1. **Baseline**: Rule-based solver for simple problems
2. **Intermediate**: 7B parameter models (Qwen, DeepSeek)
3. **Advanced**: 72B models with fine-tuning
4. **Competition**: Multi-sample + majority voting + verification

## 🔧 Configuration

### Frontend
- Edit `vite.config.ts` for build settings

### Backend
- Edit `server.ts` for API configuration

### ML Pipeline
- Edit `aimo3/config.py` for model settings

## 📝 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📧 Contact

Created by TANMAYKALA for the AIMO3 Kaggle competition.
