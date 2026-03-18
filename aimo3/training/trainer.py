"""
Training Scripts for AIMO3
==========================

Fine-tuning pipeline for mathematical reasoning models.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, field

import torch
from torch.utils.data import DataLoader


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training configuration."""
    
    # Model
    model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct"
    
    # LoRA
    use_lora: bool = True
    lora_r: int = 64
    lora_alpha: int = 128
    lora_dropout: float = 0.05
    lora_target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"])
    
    # Training
    num_epochs: int = 3
    batch_size: int = 1
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    max_steps: int = -1  # -1 means use num_epochs
    
    # Optimization
    use_8bit_adam: bool = True
    bf16: bool = True
    fp16: bool = False
    gradient_checkpointing: bool = True
    use_4bit_quantization: bool = True
    
    # Data
    max_seq_length: int = 4096
    
    # Logging
    logging_steps: int = 100
    save_steps: int = 500
    eval_steps: int = 500
    
    # Output
    output_dir: str = "./outputs"
    save_total_limit: int = 3


class MathModelTrainer:
    """
    Trainer for fine-tuning math models.
    
    Supports:
    - Supervised Fine-Tuning (SFT)
    - LoRA/PEFT efficient training
    - Multi-GPU training
    """
    
    def __init__(self, config: TrainingConfig):
        """Initialize trainer with config."""
        self.config = config
        self.model = None
        self.tokenizer = None
        self.trainer = None
    
    def setup(self):
        """Setup model, tokenizer, and training components."""
        logger.info(f"Setting up training for {self.config.model_name}")
        
        try:
            from transformers import (
                AutoModelForCausalLM,
                AutoTokenizer,
                BitsAndBytesConfig,
                TrainingArguments,
                Trainer,
                DataCollatorForLanguageModeling
            )
            from peft import get_peft_model, LoraConfig, TaskType, prepare_model_for_kbit_training
        except ImportError as e:
            raise ImportError(f"Missing required packages: {e}\nInstall with: pip install transformers peft bitsandbytes")
        
        has_cuda = torch.cuda.is_available()

        # Quantization is only applied when CUDA is available.
        bnb_config = None
        if has_cuda and self.config.use_4bit_quantization:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
        
        # Load model
        logger.info("Loading model...")
        model_kwargs = {
            "trust_remote_code": True,
        }

        if bnb_config is not None:
            model_kwargs["quantization_config"] = bnb_config
            model_kwargs["device_map"] = "auto"
            model_kwargs["torch_dtype"] = torch.bfloat16
        elif has_cuda:
            model_kwargs["device_map"] = "auto"
            model_kwargs["torch_dtype"] = torch.bfloat16 if self.config.bf16 else torch.float16
        else:
            model_kwargs["torch_dtype"] = torch.float32

        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            **model_kwargs
        )
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.config.model_name,
            trust_remote_code=True
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Prepare for k-bit training only when quantized.
        if bnb_config is not None:
            self.model = prepare_model_for_kbit_training(self.model)
        
        # Apply LoRA
        if self.config.use_lora:
            logger.info("Applying LoRA...")
            available_module_names = [name for name, _ in self.model.named_modules()]

            target_modules = [
                module
                for module in self.config.lora_target_modules
                if any(name.endswith(module) for name in available_module_names)
            ]

            # Fallback for GPT-style architectures.
            if not target_modules:
                fallback_candidates = ["c_attn", "c_proj", "c_fc"]
                target_modules = [
                    module
                    for module in fallback_candidates
                    if any(name.endswith(module) for name in available_module_names)
                ]

            if not target_modules:
                raise ValueError(
                    "Could not determine LoRA target modules for this model. "
                    "Please set TrainingConfig.lora_target_modules explicitly."
                )

            lora_config = LoraConfig(
                r=self.config.lora_r,
                lora_alpha=self.config.lora_alpha,
                target_modules=target_modules,
                lora_dropout=self.config.lora_dropout,
                bias="none",
                task_type=TaskType.CAUSAL_LM
            )
            self.model = get_peft_model(self.model, lora_config)
            self.model.print_trainable_parameters()
        
        logger.info("Setup complete!")
        return self
    
    def prepare_dataset(
        self,
        train_data: List[Dict],
        eval_data: Optional[List[Dict]] = None
    ):
        """
        Prepare datasets for training.
        
        Args:
            train_data: List of {"problem": ..., "solution": ..., "answer": ...}
            eval_data: Optional evaluation data
        """
        from torch.utils.data import Dataset
        
        class MathFineTuneDataset(Dataset):
            def __init__(self, data, tokenizer, max_length):
                self.data = data
                self.tokenizer = tokenizer
                self.max_length = max_length
            
            def __len__(self):
                return len(self.data)
            
            def __getitem__(self, idx):
                item = self.data[idx]
                
                # Format as conversation
                text = self._format_training_example(item)
                
                # Tokenize
                encoding = self.tokenizer(
                    text,
                    truncation=True,
                    max_length=self.max_length,
                    padding="max_length",
                    return_tensors="pt"
                )
                
                return {
                    "input_ids": encoding["input_ids"].squeeze(),
                    "attention_mask": encoding["attention_mask"].squeeze(),
                    "labels": encoding["input_ids"].squeeze()
                }
            
            def _format_training_example(self, item):
                """Format a single training example."""
                problem = item.get("problem", "")
                solution = item.get("solution", "")
                answer = item.get("answer", "")
                
                # Use Qwen format by default
                return f"""<|im_start|>system
You are a mathematical reasoning assistant. Solve problems step by step and put your final answer in \\boxed{{}}.<|im_end|>
<|im_start|>user
{problem}<|im_end|>
<|im_start|>assistant
{solution}

The answer is $\\boxed{{{answer}}}$.<|im_end|>"""
        
        self.train_dataset = MathFineTuneDataset(
            train_data, self.tokenizer, self.config.max_seq_length
        )
        
        if eval_data:
            self.eval_dataset = MathFineTuneDataset(
                eval_data, self.tokenizer, self.config.max_seq_length
            )
        else:
            self.eval_dataset = None
        
        logger.info(f"Training samples: {len(self.train_dataset)}")
        if self.eval_dataset:
            logger.info(f"Evaluation samples: {len(self.eval_dataset)}")
        
        return self
    
    def train(self):
        """Run training."""
        from transformers import TrainingArguments, Trainer, DataCollatorForLanguageModeling
        import inspect

        has_cuda = torch.cuda.is_available()
        
        # Training arguments (compatible with both old and new transformers APIs).
        args_kwargs = {
            "output_dir": self.config.output_dir,
            "num_train_epochs": self.config.num_epochs,
            "per_device_train_batch_size": self.config.batch_size,
            "gradient_accumulation_steps": self.config.gradient_accumulation_steps,
            "learning_rate": self.config.learning_rate,
            "weight_decay": self.config.weight_decay,
            "warmup_ratio": self.config.warmup_ratio,
            "max_steps": self.config.max_steps,
            "logging_steps": self.config.logging_steps,
            "save_steps": self.config.save_steps,
            "eval_steps": self.config.eval_steps if self.eval_dataset else None,
            "bf16": self.config.bf16 and has_cuda,
            "fp16": self.config.fp16 and has_cuda,
            "gradient_checkpointing": self.config.gradient_checkpointing,
            "optim": "adamw_8bit" if (self.config.use_8bit_adam and has_cuda) else "adamw_torch",
            "save_total_limit": self.config.save_total_limit,
            "load_best_model_at_end": True if self.eval_dataset else False,
            "report_to": ["tensorboard"],
        }

        ta_params = inspect.signature(TrainingArguments.__init__).parameters
        if "evaluation_strategy" in ta_params:
            args_kwargs["evaluation_strategy"] = "steps" if self.eval_dataset else "no"
        elif "eval_strategy" in ta_params:
            args_kwargs["eval_strategy"] = "steps" if self.eval_dataset else "no"

        training_args = TrainingArguments(**args_kwargs)
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False
        )
        
        # Trainer
        self.trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=self.train_dataset,
            eval_dataset=self.eval_dataset,
            data_collator=data_collator,
        )
        
        logger.info("Starting training...")
        self.trainer.train()
        logger.info("Training complete!")
        
        return self
    
    def save(self, path: Optional[str] = None):
        """Save the fine-tuned model."""
        save_path = path or os.path.join(self.config.output_dir, "final_model")
        
        logger.info(f"Saving model to {save_path}")
        self.model.save_pretrained(save_path)
        self.tokenizer.save_pretrained(save_path)
        
        # Save config
        config_path = os.path.join(save_path, "training_config.json")
        with open(config_path, "w") as f:
            json.dump(vars(self.config), f, indent=2)
        
        logger.info("Model saved!")
        return save_path


def train_math_model(
    train_data: List[Dict],
    eval_data: Optional[List[Dict]] = None,
    model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct",
    output_dir: str = "./outputs",
    **kwargs
) -> str:
    """
    Convenience function to train a math model.
    
    Args:
        train_data: Training data
        eval_data: Evaluation data
        model_name: Base model name
        output_dir: Output directory
        **kwargs: Additional TrainingConfig parameters
    
    Returns:
        Path to saved model
    """
    config = TrainingConfig(
        model_name=model_name,
        output_dir=output_dir,
        **kwargs
    )
    
    trainer = MathModelTrainer(config)
    trainer.setup()
    trainer.prepare_dataset(train_data, eval_data)
    trainer.train()
    
    return trainer.save()


def load_training_data(data_path: Union[str, Path]) -> List[Dict]:
    """
    Load training data from file.
    
    Supports JSON and JSONL formats.
    """
    data_path = Path(data_path)
    
    if data_path.suffix == ".json":
        with open(data_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif data_path.suffix == ".jsonl":
        data = []
        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                data.append(json.loads(line))
        return data
    else:
        raise ValueError(f"Unsupported file format: {data_path.suffix}")


if __name__ == "__main__":
    # Example usage
    import argparse
    
    parser = argparse.ArgumentParser(description="Train AIMO3 Math Model")
    parser.add_argument("--data", type=str, required=True, help="Path to training data")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-Math-7B-Instruct")
    parser.add_argument("--output", type=str, default="./outputs")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    
    args = parser.parse_args()
    
    train_data = load_training_data(args.data)
    
    model_path = train_math_model(
        train_data=train_data,
        model_name=args.model,
        output_dir=args.output,
        num_epochs=args.epochs,
        learning_rate=args.lr
    )
    
    print(f"Model saved to: {model_path}")
