"""
Base Model Loading and Management for AIMO3
============================================

Handles loading of various LLM models with appropriate configurations.
"""

import os
from pathlib import Path
from typing import Dict, Optional, Tuple, Union

import torch


class MathModel:
    """
    Wrapper class for math-focused LLM models.
    
    Supports loading models from HuggingFace with various optimizations
    including quantization, LoRA, and device mapping.
    """
    
    def __init__(
        self,
        model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct",
        load_in_4bit: bool = True,
        load_in_8bit: bool = False,
        device_map: str = "auto",
        torch_dtype: str = "bfloat16",
        use_flash_attention: bool = True,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize the MathModel.
        
        Args:
            model_name: HuggingFace model name or path
            load_in_4bit: Use 4-bit quantization (saves memory)
            load_in_8bit: Use 8-bit quantization
            device_map: Device mapping strategy
            torch_dtype: Model dtype (bfloat16, float16, float32)
            use_flash_attention: Use Flash Attention 2 if available
            cache_dir: Directory to cache model files
        """
        self.model_name = model_name
        self.load_in_4bit = load_in_4bit
        self.load_in_8bit = load_in_8bit
        self.device_map = device_map
        self.torch_dtype = getattr(torch, torch_dtype) if isinstance(torch_dtype, str) else torch_dtype
        self.use_flash_attention = use_flash_attention
        self.cache_dir = cache_dir
        
        self.model = None
        self.tokenizer = None
        self._is_loaded = False
    
    def load(self) -> "MathModel":
        """Load the model and tokenizer."""
        if self._is_loaded:
            return self
        
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        except ImportError:
            raise ImportError("Please install transformers: pip install transformers")
        
        print(f"Loading model: {self.model_name}")
        
        # Configure quantization
        quantization_config = None
        if self.load_in_4bit:
            try:
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=self.torch_dtype,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4"
                )
            except Exception as e:
                print(f"Warning: Could not configure 4-bit quantization: {e}")
                print("Loading without quantization...")
        elif self.load_in_8bit:
            try:
                quantization_config = BitsAndBytesConfig(
                    load_in_8bit=True,
                )
            except Exception as e:
                print(f"Warning: Could not configure 8-bit quantization: {e}")
        
        # Model loading kwargs
        model_kwargs = {
            "device_map": self.device_map,
            "torch_dtype": self.torch_dtype,
            "trust_remote_code": True,
        }
        
        if quantization_config:
            model_kwargs["quantization_config"] = quantization_config
        
        if self.use_flash_attention:
            model_kwargs["attn_implementation"] = "flash_attention_2"
        
        if self.cache_dir:
            model_kwargs["cache_dir"] = self.cache_dir
        
        # Load model
        try:
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                **model_kwargs
            )
        except Exception as e:
            print(f"Error loading with flash attention, trying without: {e}")
            model_kwargs.pop("attn_implementation", None)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                **model_kwargs
            )
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            trust_remote_code=True,
            cache_dir=self.cache_dir
        )
        
        # Ensure padding token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        self._is_loaded = True
        print(f"Model loaded successfully on {self.device_map}")
        
        return self
    
    def generate(
        self,
        prompt: str,
        max_new_tokens: int = 4096,
        temperature: float = 0.7,
        top_p: float = 0.95,
        do_sample: bool = True,
        num_return_sequences: int = 1,
        **kwargs
    ) -> Union[str, list]:
        """
        Generate text from a prompt.
        
        Args:
            prompt: Input text
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter
            do_sample: Whether to use sampling
            num_return_sequences: Number of sequences to generate
        
        Returns:
            Generated text or list of texts
        """
        if not self._is_loaded:
            self.load()
        
        # Tokenize input
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=4096
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature if do_sample else None,
                top_p=top_p if do_sample else None,
                do_sample=do_sample,
                num_return_sequences=num_return_sequences,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
                **kwargs
            )
        
        # Decode
        generated = self.tokenizer.batch_decode(
            outputs[:, inputs["input_ids"].shape[1]:],
            skip_special_tokens=True
        )
        
        if num_return_sequences == 1:
            return generated[0]
        return generated
    
    def get_lora_model(
        self,
        r: int = 64,
        alpha: int = 128,
        dropout: float = 0.05,
        target_modules: Optional[list] = None
    ):
        """
        Apply LoRA adapters for efficient fine-tuning.
        
        Args:
            r: LoRA rank
            alpha: LoRA alpha
            dropout: Dropout rate
            target_modules: Modules to apply LoRA to
        
        Returns:
            Model with LoRA adapters
        """
        if not self._is_loaded:
            self.load()
        
        try:
            from peft import get_peft_model, LoraConfig, TaskType
        except ImportError:
            raise ImportError("Please install peft: pip install peft")
        
        if target_modules is None:
            target_modules = ["q_proj", "v_proj", "k_proj", "o_proj"]
        
        lora_config = LoraConfig(
            r=r,
            lora_alpha=alpha,
            target_modules=target_modules,
            lora_dropout=dropout,
            bias="none",
            task_type=TaskType.CAUSAL_LM
        )
        
        self.model = get_peft_model(self.model, lora_config)
        print(f"LoRA applied. Trainable parameters: {self.model.print_trainable_parameters()}")
        
        return self.model
    
    def save(self, path: Union[str, Path]):
        """Save the model and tokenizer."""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        
        self.model.save_pretrained(path)
        self.tokenizer.save_pretrained(path)
        print(f"Model saved to {path}")
    
    @classmethod
    def from_pretrained(cls, path: Union[str, Path], **kwargs) -> "MathModel":
        """Load a saved model."""
        model = cls(model_name=str(path), **kwargs)
        return model.load()


def load_model(
    model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct",
    **kwargs
) -> MathModel:
    """
    Convenience function to load a model.
    
    Args:
        model_name: Model identifier
        **kwargs: Additional arguments for MathModel
    
    Returns:
        Loaded MathModel instance
    """
    return MathModel(model_name=model_name, **kwargs).load()


# Pre-configured model loaders for common models
def load_qwen_math_7b(**kwargs) -> MathModel:
    """Load Qwen2.5-Math-7B-Instruct."""
    return load_model("Qwen/Qwen2.5-Math-7B-Instruct", **kwargs)


def load_qwen_math_72b(**kwargs) -> MathModel:
    """Load Qwen2.5-Math-72B-Instruct (requires high VRAM)."""
    return load_model("Qwen/Qwen2.5-Math-72B-Instruct", **kwargs)


def load_deepseek_math(**kwargs) -> MathModel:
    """Load DeepSeek-Math-7B-Instruct."""
    return load_model("deepseek-ai/deepseek-math-7b-instruct", **kwargs)
