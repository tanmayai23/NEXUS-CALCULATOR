"""
AIMO3 Configuration Settings
============================

All configurable parameters for the AIMO3 competition pipeline.
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional
from pathlib import Path


@dataclass
class ModelConfig:
    """Configuration for model loading and inference."""
    
    # Model selection
    model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct"  # Default smaller model for testing
    
    # Available models (ranked by capability)
    AVAILABLE_MODELS = {
        "small": [
            "Qwen/Qwen2.5-Math-1.5B-Instruct",
            "Qwen/Qwen2.5-Math-7B-Instruct",
            "deepseek-ai/deepseek-math-7b-instruct",
        ],
        "medium": [
            "Qwen/Qwen2.5-Math-72B-Instruct",
            "deepseek-ai/DeepSeek-V2.5",
        ],
        "large": [
            "Qwen/Qwen2.5-72B-Instruct",
            "meta-llama/Llama-3.1-70B-Instruct",
        ],
        "kaggle": [
            "gpt-oss-20b",  # Kaggle-hosted
            "gpt-oss-120b",  # Kaggle-hosted
        ]
    }
    
    # Quantization settings
    load_in_8bit: bool = False
    load_in_4bit: bool = True  # Use 4-bit for memory efficiency
    
    # Device settings
    device_map: str = "auto"
    torch_dtype: str = "bfloat16"
    
    # Generation settings
    max_new_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 0.95
    do_sample: bool = True
    
    # LoRA fine-tuning settings
    lora_r: int = 64
    lora_alpha: int = 128
    lora_dropout: float = 0.05
    lora_target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"])


@dataclass
class DataConfig:
    """Configuration for data loading and processing."""
    
    # Dataset paths
    math_dataset_path: str = "hendrycks/math"
    gsm8k_path: str = "gsm8k"
    custom_dataset_path: Optional[str] = None
    
    # Data processing
    max_sequence_length: int = 4096
    train_split: float = 0.9
    
    # Batch settings
    batch_size: int = 1
    gradient_accumulation_steps: int = 4


@dataclass
class TrainingConfig:
    """Configuration for model training."""
    
    # Training parameters
    num_epochs: int = 3
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_steps: int = 500
    max_steps: int = 10000
    
    # Logging
    logging_steps: int = 100
    save_steps: int = 1000
    eval_steps: int = 500
    
    # Output
    output_dir: str = "./outputs"
    
    # Optimization
    use_8bit_adam: bool = True
    fp16: bool = False
    bf16: bool = True
    gradient_checkpointing: bool = True


@dataclass
class InferenceConfig:
    """Configuration for inference and solution generation."""
    
    # Multi-sample reasoning
    num_samples: int = 8  # Generate multiple solutions
    temperature_range: tuple = (0.5, 1.0)  # Vary temperature for diversity
    
    # Test-time compute scaling
    time_budget_seconds: int = 300  # 5 minutes per problem
    max_attempts: int = 16
    
    # Answer extraction
    answer_pattern: str = r"\\boxed{(\d+)}"  # LaTeX boxed answer pattern
    
    # Verification
    use_verifier: bool = True
    verifier_threshold: float = 0.7
    
    # Majority voting
    use_majority_vote: bool = True


@dataclass
class AIMO3Config:
    """Main configuration class combining all settings."""
    
    model: ModelConfig = field(default_factory=ModelConfig)
    data: DataConfig = field(default_factory=DataConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)
    inference: InferenceConfig = field(default_factory=InferenceConfig)
    
    # Project paths
    project_root: Path = field(default_factory=lambda: Path(__file__).parent.parent)
    
    # Competition settings
    competition_name: str = "ai-mathematical-olympiad-progress-prize-3"
    num_problems: int = 110
    answer_range: tuple = (0, 99999)
    
    def __post_init__(self):
        """Create necessary directories."""
        dirs = [
            self.project_root / "outputs",
            self.project_root / "checkpoints",
            self.project_root / "data" / "raw",
            self.project_root / "data" / "processed",
            self.project_root / "logs",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)


# Default configuration instance
config = AIMO3Config()
