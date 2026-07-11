import os
import re

from ..config import TranslatorConfig
from .config_gpt import ConfigGPT  # Import the `gpt_config` parsing parent class

try:
    import openai
except ImportError:
    openai = None
import asyncio
import time
from typing import List
from .common import CommonTranslator, VALID_LANGUAGES
from .keys import CUSTOM_OPENAI_API_KEY, CUSTOM_OPENAI_API_BASE, CUSTOM_OPENAI_MODEL, CUSTOM_OPENAI_MODEL_CONF


class EmptyContentError(Exception):
    """#631: the gateway returned a completion whose ``message.content`` is ``None``
    (the #623 dense-page failure mode — a qwen3-style model can emit only EOS/reasoning
    and no content; thinking-off reduces but does not eliminate it). Raised instead of
    returning ``None`` so the ``_translate`` retry loop treats it as a retryable server
    fault — ``extract_capture_groups(None)`` would ``TypeError`` and 500 the whole page."""


def resolve_enable_thinking(env=None) -> bool:
    """Whether to leave the LLM's native thinking/reasoning mode on. Default OFF:
    a qwen3-style reasoning model can spend the whole ``max_tokens`` budget on
    ``<think>`` output and return empty ``content`` on dense pages (#623 — the
    One-Punch narration group: 6502 chars of reasoning → completion cap hit →
    ``content=None`` → the translate 500s the whole page). Set
    ``CUSTOM_OPENAI_ENABLE_THINKING=true`` to re-enable for a non-thinking model."""
    if env is None:
        env = os.environ
    return str(env.get('CUSTOM_OPENAI_ENABLE_THINKING', 'false')).strip().lower() in ('1', 'true', 'yes', 'on')


def thinking_extra_body(enable_thinking: bool):
    """``extra_body`` for ``chat.completions.create`` that suppresses qwen3-style
    thinking when disabled (``chat_template_kwargs.enable_thinking=false`` — the
    lever the 9arm/vLLM gateway honours; a top-level ``enable_thinking`` is
    ignored). Returns ``None`` when thinking is enabled so the call is unchanged."""
    if enable_thinking:
        return None
    return {'chat_template_kwargs': {'enable_thinking': False}}


def resolve_max_completion_tokens(env=None, default: int = 4096) -> int:
    """#631: the completion-token cap for the translate call. qwen3.6 via the 9arm gateway
    IGNORES every thinking-disable lever (chat_template_kwargs.enable_thinking / reasoning_effort
    / '/no_think' — measured: ~6-8k chars of reasoning emitted regardless), so the completion
    budget must fit reasoning + content. The old cap (``_MAX_TOKENS // 2`` = 2048) hit
    ``finish=length`` with ``content=None`` on dense pages (#623's root, resurfaced). Default
    4096 (measured dense page: reasoning+content ≈ 2.7k). Override via
    ``CUSTOM_OPENAI_MAX_COMPLETION_TOKENS``."""
    if env is None:
        env = os.environ
    raw = env.get('CUSTOM_OPENAI_MAX_COMPLETION_TOKENS', '')
    try:
        v = int(str(raw).strip())
        return v if v > 0 else default
    except (TypeError, ValueError):
        return default


def parse_numbered_translations(response: str, query_size: int):
    """Map a ``<|i|>text`` response to EXACTLY ``query_size`` translations, BY INDEX.

    #535 root: the former inline ``re.split(r'<\\|\\d+\\|>', ...)`` was positional (a dropped
    index shifted every later bubble) and strict (a malformed ``<|10|`` with no closing ``>``
    leaked into the text). Delegates to ``numbered_contract`` (index-based + malformed-marker
    tolerant); falls back to a whole-body / newline split only when there is no marker at all."""
    from .numbered_contract import normalize_numbered_output, _BLOCK_RE
    if _BLOCK_RE.search(response or ''):
        return [('' if t.startswith('[Missing item') else t)
                for t in normalize_numbered_output(response, query_size)]
    if query_size == 1:
        return [(response or '').strip()]
    parts = [t.strip() for t in re.split(r'\n', response or '') if t.strip()]
    if len(parts) > query_size:
        parts = parts[:query_size]
    elif len(parts) < query_size:
        parts = parts + [''] * (query_size - len(parts))
    return parts


class CustomOpenAiTranslator(ConfigGPT, CommonTranslator):
    _INVALID_REPEAT_COUNT = 2  # 如果检测到"无效"翻译，最多重复 2 次
    _MAX_REQUESTS_PER_MINUTE = 40  # 每分钟最大请求次数
    _TIMEOUT = 40  # 在重试之前等待服务器响应的时间（秒）
    _RETRY_ATTEMPTS = 3  # 在放弃之前重试错误请求的次数
    _TIMEOUT_RETRY_ATTEMPTS = 3  # 在放弃之前重试超时请求的次数
    _RATELIMIT_RETRY_ATTEMPTS = 3  # 在放弃之前重试速率限制请求的次数

    # 最大令牌数量，用于控制处理的文本长度
    _MAX_TOKENS = 4096

    # 是否返回原始提示，用于控制输出内容
    _RETURN_PROMPT = False

    # 是否包含模板，用于决定是否使用预设的提示模板
    _INCLUDE_TEMPLATE = False

    def __init__(self, model=None, api_base=None, api_key=None, check_openai_key=False):
        # If the user has specified a nested key to use for the model, append the key
        #   Otherwise: Use the `ollama` defaults.
        _CONFIG_KEY='ollama'
        if CUSTOM_OPENAI_MODEL_CONF:
            _CONFIG_KEY+=f".{CUSTOM_OPENAI_MODEL_CONF}"

        ConfigGPT.__init__(self, config_key=_CONFIG_KEY)
        self.model = model
        CommonTranslator.__init__(self)
        self.client = openai.AsyncOpenAI(api_key=api_key or CUSTOM_OPENAI_API_KEY or "ollama") # required, but unused for ollama
        self.client.base_url = api_base or CUSTOM_OPENAI_API_BASE
        self.token_count = 0
        self.token_count_last = 0

    def parse_args(self, args: TranslatorConfig):
        self.config = args.chatgpt_config


    def extract_capture_groups(self, text, regex=r"(.*)"):
        """
        Extracts all capture groups from matches and concatenates them into a single string.
        
        :param text: The multi-line text to search.
        :param regex: The regex pattern with capture groups.
        :return: A concatenated string of all matched groups.
        """
        pattern = re.compile(regex, re.DOTALL)  # DOTALL to match across multiple lines
        matches = pattern.findall(text)  # Find all matches
        
        # Ensure matches are concatonated (handles multiple groups per match)
        extracted_text = "\n".join(
            "\n".join(m) if isinstance(m, tuple) else m for m in matches
        )
        
        return extracted_text.strip() if extracted_text else None

    def _assemble_prompts(self, from_lang: str, to_lang: str, queries: List[str]):
        prompt = ''

        if self._INCLUDE_TEMPLATE:
            prompt += self.prompt_template.format(to_lang=to_lang)

        if self._RETURN_PROMPT:
            prompt += '\nOriginal:'

        i_offset = 0
        for i, query in enumerate(queries):
            prompt += f'\n<|{i + 1 - i_offset}|>{query}'

            # If prompt is growing too large and there's still a lot of text left
            # split off the rest of the queries into new prompts.
            # 1 token = ~4 characters according to https://platform.openai.com/tokenizer
            # TODO: potentially add summarizations from special requests as context information
            if self._MAX_TOKENS * 2 and len(''.join(queries[i + 1:])) > self._MAX_TOKENS:
                if self._RETURN_PROMPT:
                    prompt += '\n<|1|>'
                yield prompt.lstrip(), i + 1 - i_offset
                prompt = self.prompt_template.format(to_lang=to_lang)
                # Restart counting at 1
                i_offset = i + 1

        if self._RETURN_PROMPT:
            prompt += '\n<|1|>'

        yield prompt.lstrip(), len(queries) - i_offset

    def _format_prompt_log(self, to_lang: str, prompt: str) -> str:
        if to_lang in self.chat_sample:
            return '\n'.join([
                'System:',
                self.chat_system_template.format(to_lang=to_lang),
                'User:',
                self.chat_sample[to_lang][0],
                'Assistant:',
                self.chat_sample[to_lang][1],
                'User:',
                prompt,
            ])
        else:
            return '\n'.join([
                'System:',
                self.chat_system_template.format(to_lang=to_lang),
                'User:',
                prompt,
            ])

    async def _translate(self, from_lang: str, to_lang: str, queries: List[str]) -> List[str]:
        translations = []
        self.logger.debug(f'Temperature: {self.temperature}, TopP: {self.top_p}')

        for prompt, query_size in self._assemble_prompts(from_lang, to_lang, queries):
            self.logger.debug('-- GPT Prompt --\n' + self._format_prompt_log(to_lang, prompt))

            ratelimit_attempt = 0
            server_error_attempt = 0
            timeout_attempt = 0
            while True:
                request_task = asyncio.create_task(self._request_translation(to_lang, prompt))
                started = time.time()
                while not request_task.done():
                    await asyncio.sleep(0.1)
                    if time.time() - started > self._TIMEOUT + (timeout_attempt * self._TIMEOUT / 2):
                        # Server takes too long to respond
                        if timeout_attempt >= self._TIMEOUT_RETRY_ATTEMPTS:
                            # Surface a structured, actionable failure (PRD #279, slice 1e)
                            # instead of an opaque string — names the translator/endpoint/
                            # model + cause + hint for the worker log and backend response.
                            from server.translate_error import classify_translate_error
                            failure = classify_translate_error(
                                TimeoutError('translator did not respond quickly enough'),
                                translator='custom_openai',
                                endpoint=CUSTOM_OPENAI_API_BASE or '',
                                model=self.model or CUSTOM_OPENAI_MODEL,
                            )
                            self.logger.error(failure.message())
                            raise Exception(failure.message())
                        timeout_attempt += 1
                        self.logger.warning(f'Restarting request due to timeout. Attempt: {timeout_attempt}')
                        request_task.cancel()
                        request_task = asyncio.create_task(self._request_translation(to_lang, prompt))
                        started = time.time()
                try:
                    response = await request_task
                    break
                except openai.RateLimitError:  # Server returned ratelimit response
                    ratelimit_attempt += 1
                    if ratelimit_attempt >= self._RATELIMIT_RETRY_ATTEMPTS:
                        raise
                    self.logger.warning(
                        f'Restarting request due to ratelimiting by Ollama servers. Attempt: {ratelimit_attempt}')
                    await asyncio.sleep(2)
                except openai.APIError:  # Server returned 500 error (probably server load)
                    server_error_attempt += 1
                    if server_error_attempt >= self._RETRY_ATTEMPTS:
                        self.logger.error(
                            'Ollama encountered a server error, possibly due to high server load. Use a different translator or try again later.')
                        raise
                    self.logger.warning(f'Restarting request due to a server error. Attempt: {server_error_attempt}')
                    await asyncio.sleep(1)
                except EmptyContentError:  # #631: gateway returned content=None (dense-page mode)
                    server_error_attempt += 1
                    if server_error_attempt >= self._RETRY_ATTEMPTS:
                        self.logger.error(
                            'Translator returned empty content (content=None) on every attempt — '
                            'gateway/model dense-request failure (#623/#631).')
                        raise
                    self.logger.warning(f'Restarting request due to empty content (content=None). Attempt: {server_error_attempt}')
                    await asyncio.sleep(1)

            # self.logger.debug('-- GPT Response --\n' + response)
            

            # Use regex to extract response 
            response=self.extract_capture_groups(response, rf"{self.rgx_capture}")


            # #535: index-based, malformed-marker-tolerant parse (was a positional
            # re.split that shifted on a dropped index and leaked '<|10|' fragments).
            new_translations = parse_numbered_translations(response, query_size)
            translations.extend([t.strip() for t in new_translations])

        for t in translations:
            if "I'm sorry, but I can't assist with that request" in t:
                raise Exception('translations contain error text')
        self.logger.debug(translations)
        if self.token_count_last:
            self.logger.info(f'Used {self.token_count_last} tokens (Total: {self.token_count})')

        return translations

    async def _request_translation(self, to_lang: str, prompt: str) -> str:
        messages = [{'role': 'system', 'content': self.chat_system_template.format(to_lang=to_lang)}]

        # Add chat samples if available
        lang_chat_samples = self.get_chat_sample(to_lang)
        if lang_chat_samples:
            messages.append({'role': 'user', 'content': lang_chat_samples[0]})
            messages.append({'role': 'assistant', 'content': lang_chat_samples[1]})

        messages.append({'role': 'user', 'content': prompt})

        create_kwargs = dict(
            model=self.model or CUSTOM_OPENAI_MODEL,
            messages=messages,
            # #631: was `self._MAX_TOKENS // 2` (=2048) — not enough for qwen3.6's
            # un-disableable reasoning (~2k tokens) + content on dense pages → finish=length,
            # content=None, whole-page 500. See resolve_max_completion_tokens.
            max_tokens=resolve_max_completion_tokens(),
            temperature=self.temperature,
            top_p=self.top_p,
        )
        # #623: disable the model's native thinking (qwen3-style) unless the operator
        # opts back in via CUSTOM_OPENAI_ENABLE_THINKING — otherwise a reasoning model
        # burns the whole max_tokens budget on <think> and returns empty content on
        # dense pages (verified: dense group 2048-tok exhausted → None; thinking off → 86 tok).
        _extra = thinking_extra_body(resolve_enable_thinking())
        if _extra is not None:
            create_kwargs['extra_body'] = _extra
        response = await self.client.chat.completions.create(**create_kwargs)

        self.logger.debug('\n-- GPT Response (raw) --')
        self.logger.debug(response.choices[0].message.content)
        self.logger.debug('------------------------\n')


        self.token_count += response.usage.total_tokens
        self.token_count_last = response.usage.total_tokens

        # #speed-study Phase 2c (T1, OPTIMIZATION.md): de-confound prompt vs
        # completion tokens — total_tokens alone can't tell whether a slow
        # translation call is prompt-bound (context/system-prompt size) or
        # completion-bound (verbose output). The 9arm/ollama-compat gateway may
        # not populate these fields; log 'n/a' rather than raise if absent.
        prompt_tokens = getattr(response.usage, 'prompt_tokens', None)
        completion_tokens = getattr(response.usage, 'completion_tokens', None)
        self.logger.info(
            f'Token split: prompt={prompt_tokens if prompt_tokens is not None else "n/a"} '
            f'completion={completion_tokens if completion_tokens is not None else "n/a"}'
        )

        content = response.choices[0].message.content
        if content is None:
            # #631: the gateway sometimes returns finish=stop with content=None on dense
            # requests (#623 root; thinking-off reduces but does not eliminate it). Raise a
            # retryable error — returning None would TypeError in extract_capture_groups
            # and 500 the whole page.
            raise EmptyContentError(
                f'translator returned empty content (content=None, finish='
                f'{getattr(response.choices[0], "finish_reason", "?")}, '
                f'completion_tokens={completion_tokens})')
        return content
