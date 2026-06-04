import os
import re
from typing import List

from ..config import TranslatorConfig
from .common import OfflineTranslator
from .config_gpt import ConfigGPT


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks from Qwen3 output (safety net for older transformers)."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


class Qwen3Translator(OfflineTranslator, ConfigGPT):
    _LANGUAGE_CODE_MAP = {
        'CHS': 'Simplified Chinese',
        'CHT': 'Traditional Chinese',
        'CSY': 'Czech',
        'NLD': 'Dutch',
        'ENG': 'English',
        'FRA': 'French',
        'DEU': 'German',
        'HUN': 'Hungarian',
        'ITA': 'Italian',
        'JPN': 'Japanese',
        'KOR': 'Korean',
        'POL': 'Polish',
        'PTB': 'Portuguese',
        'ROM': 'Romanian',
        'RUS': 'Russian',
        'ESP': 'Spanish',
        'TRK': 'Turkish',
        'UKR': 'Ukrainian',
        'VIN': 'Vietnamese',
        'CNR': 'Montenegrin',
        'SRP': 'Serbian',
        'HRV': 'Croatian',
        'ARA': 'Arabic',
        'THA': 'Thai',
        'IND': 'Indonesian',
    }

    _TRANSLATOR_MODEL = os.environ.get('QWEN3_MODEL', 'Qwen/Qwen3-4B-Instruct')
    _MODEL_SUB_DIR = os.path.join(OfflineTranslator._MODEL_DIR, OfflineTranslator._MODEL_SUB_DIR, _TRANSLATOR_MODEL)
    _IS_4_BIT = os.environ.get('QWEN3_4BIT', 'false').lower() in ('1', 'true', 'yes')

    def __init__(self):
        OfflineTranslator.__init__(self)
        ConfigGPT.__init__(self, config_key='qwen3')

    def parse_args(self, args: TranslatorConfig):
        self.config = args.chatgpt_config

    async def _load(self, from_lang: str, to_lang: str, device: str):
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        self.device = device
        is_4bit = os.environ.get('QWEN3_4BIT', 'false').lower() in ('1', 'true', 'yes')
        torch_dtype = os.environ.get('QWEN3_TORCH_DTYPE', 'auto')
        model_id = os.environ.get('QWEN3_MODEL', self._TRANSLATOR_MODEL)
        quantization_config = BitsAndBytesConfig(load_in_4bit=is_4bit)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch_dtype,
            quantization_config=quantization_config,
            device_map='auto',
        )
        self.model.eval()
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)

    async def _unload(self):
        del self.model
        del self.tokenizer

    async def _infer(self, from_lang: str, to_lang: str, queries: List[str]) -> List[str]:
        model_inputs = self.tokenize(queries, to_lang)
        max_new_tokens = int(os.environ.get('QWEN3_MAX_NEW_TOKENS', '4096'))
        generated_ids = self.model.generate(
            model_inputs.input_ids,
            attention_mask=model_inputs.attention_mask,
            max_new_tokens=max_new_tokens,
        )
        generated_ids = [
            output_ids[len(input_ids):]
            for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]
        raw = self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
        response = _strip_think_tags(raw)

        query_size = len(queries)
        self.logger.debug('-- Qwen3 Response --\n' + response)
        new_translations = re.split(r'<\|\d+\|>', response)

        if not new_translations[0].strip():
            new_translations = new_translations[1:]
        if len(new_translations) <= 1 and query_size > 1:
            new_translations = re.split(r'\n', response)
        if len(new_translations) > query_size:
            new_translations = new_translations[:query_size]
        elif len(new_translations) < query_size:
            new_translations = new_translations + [''] * (query_size - len(new_translations))

        return [t.strip() for t in new_translations]

    def tokenize(self, queries: List[str], to_lang: str):
        prompt = f'Translate into {to_lang} and keep the original format.\n\nOriginal:'
        for i, query in enumerate(queries):
            prompt += f'\n<|{i+1}|>{query}'

        messages = [{'role': 'system', 'content': self.chat_system_template.format(to_lang=to_lang)}]
        if to_lang in self.chat_sample:
            messages.append({'role': 'user', 'content': self.chat_sample[to_lang][0]})
            messages.append({'role': 'assistant', 'content': self.chat_sample[to_lang][1]})
        messages.append({'role': 'user', 'content': prompt})

        self.logger.debug('-- Qwen3 prompt --\n' +
            '\n'.join(f"{m['role'].capitalize()}:\n {m['content']}" for m in messages))

        # enable_thinking=False: suppress <think> blocks (requires transformers >= 4.51.0)
        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        return self.tokenizer(
            [text],
            return_tensors='pt',
            padding=True,
            truncation=True,
            max_length=self.tokenizer.model_max_length,
            return_attention_mask=True,
        ).to(self.device)


class Qwen3BigTranslator(Qwen3Translator):
    _TRANSLATOR_MODEL = os.environ.get('QWEN3_BIG_MODEL', 'Qwen/Qwen3-8B-Instruct')
    _MODEL_SUB_DIR = os.path.join(OfflineTranslator._MODEL_DIR, OfflineTranslator._MODEL_SUB_DIR, _TRANSLATOR_MODEL)
    _IS_4_BIT = os.environ.get('QWEN3_BIG_4BIT', 'false').lower() in ('1', 'true', 'yes')
