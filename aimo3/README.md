# AIMO3 - AI Mathematical Olympiad Progress Prize 3

## Competition Solution for Nexus Math Weaver

This directory contains the complete ML pipeline for the AIMO3 Kaggle competition.

## 🏆 Competition Overview

- **Goal**: Solve 110 IMO-level math problems
- **Answer Format**: Integer 0-99999
- **Scoring**: 47/50 on both runs required for winning

## 📁 Project Structure

```
aimo3/
├── __init__.py           # Package initialization
├── config.py             # Configuration settings
├── api/                  # Backend API integration
│   ├── __init__.py
│   └── solve.py          # Solver API script
├── data/                 # Data processing
│   ├── __init__.py
│   ├── dataset.py        # Dataset loading
│   └── preprocessing.py  # Data preprocessing
├── models/               # Model components
│   ├── __init__.py
│   ├── base.py           # Base model loading
│   ├── inference.py      # Inference engine
│   └── verifier.py       # Solution verification
├── training/             # Training pipeline
│   ├── __init__.py
│   └── trainer.py        # Fine-tuning scripts
├── utils/                # Utility functions
│   └── __init__.py
└── kaggle/               # Kaggle notebooks
    ├── __init__.py
    └── aimo3_submission.ipynb
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Test the Rule-Based Solver (No GPU Required)

```bash
python -m aimo3.api.solve --problem "What is the remainder when 2^100 is divided by 7?"
```

### 3. Run with GPU Model

```bash
python -m aimo3.api.solve --problem "Your problem here" --use_gpu --model "Qwen/Qwen2.5-Math-7B-Instruct"
```

## 📊 Using the Frontend

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd nexus-math-weaver
   npm run dev
   ```

3. Click "AIMO3 Solver" button in the header to access the competition solver.

## 🔧 Configuration

Edit `config.py` to customize:
- Model selection
- Number of solution samples
- Temperature range
- Time budget
- LoRA parameters for fine-tuning

## 📈 Training Your Own Model

### 1. Prepare Dataset

```python
from aimo3.data import load_math_dataset, load_gsm8k

# Load MATH dataset
math_data = load_math_dataset(split="train")

# Load GSM8K for additional training
gsm_data = load_gsm8k(split="train")
```

### 2. Fine-tune with LoRA

```python
from aimo3.training import train_math_model

model_path = train_math_model(
    train_data=training_data,
    model_name="Qwen/Qwen2.5-Math-7B-Instruct",
    output_dir="./outputs",
    num_epochs=3,
    learning_rate=2e-4
)
```

### 3. Run Inference

```python
from aimo3.models import MathSolver, load_model

# Load model
model = load_model("./outputs/final_model")

# Create solver
solver = MathSolver(
    model=model,
    num_samples=8,
    use_majority_vote=True
)

# Solve problem
result = solver.solve("What is 2^100 mod 7?")
print(f"Answer: {result.answer}")
print(f"Confidence: {result.confidence}")
```

## 🏅 Kaggle Submission

1. Open `kaggle/aimo3_submission.ipynb`
2. Upload to Kaggle
3. Add competition data
4. Enable GPU
5. Submit!

## 📚 Resources

- [AIMO3 Competition Page](https://www.kaggle.com/competitions/ai-mathematical-olympiad-progress-prize-3)
- [MATH Dataset](https://github.com/hendrycks/math)
- [OpenMathReasoning Paper](https://arxiv.org/abs/2504.16891)

## 🛠️ Hardware Requirements

| Model | VRAM | Performance |
|-------|------|-------------|
| Qwen2.5-Math-7B | 8GB | Good |
| Qwen2.5-Math-72B | 48GB | Excellent |
| DeepSeek-Math-7B | 8GB | Good |

## 📝 License

MIT License - see main project LICENSE file.
