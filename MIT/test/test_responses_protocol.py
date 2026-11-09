"""OpenAI Responses protocol for the translator (#1143 model sweep), torch-free.

gpt-6-luna is served only on /v1/responses; these tests pin the mapping both ways so a chat-shaped request and
the fields custom_openai reads stay in sync.
"""
from types import SimpleNamespace

from manga_translator.anthropic_messages import protocol_from_env
from manga_translator.response_protocol import (ENV_RESPONSES_MODEL, from_responses, responses_endpoint,
                                                responses_model, to_responses_payload)


def test_the_protocol_selector_knows_responses(monkeypatch):
    monkeypatch.setenv('CUSTOM_OPENAI_PROTOCOL', 'responses')
    assert protocol_from_env() == 'responses'
    monkeypatch.setenv('CUSTOM_OPENAI_PROTOCOL', 'openai')
    assert protocol_from_env() == 'openai'


def test_the_endpoint_and_model_come_from_the_base_and_the_env(monkeypatch):
    monkeypatch.delenv('CUSTOM_OPENAI_RESPONSES_BASE', raising=False)
    assert responses_endpoint('https://gw/zen/go/openai/v1') == 'https://gw/zen/go/openai/v1/responses'
    monkeypatch.setenv('CUSTOM_OPENAI_RESPONSES_BASE', 'https://gw/zen/go/responses')
    assert responses_endpoint('https://gw/zen/go/openai/v1') == 'https://gw/zen/go/responses'
    monkeypatch.delenv(ENV_RESPONSES_MODEL, raising=False)
    assert responses_model('deepseek') == 'deepseek'
    monkeypatch.setenv(ENV_RESPONSES_MODEL, 'gpt-6-luna')
    assert responses_model('deepseek') == 'gpt-6-luna'


def test_the_chat_request_maps_onto_responses_input():
    messages = [
        {'role': 'system', 'content': 'You are a manga translator.'},
        {'role': 'user', 'content': 'SAMPLE'},
        {'role': 'assistant', 'content': 'ตัวอย่าง'},
        {'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,AAA'}},
            {'type': 'text', 'text': '1. I am glad.'}]},
    ]
    payload = to_responses_payload(messages, 'gpt-6-luna', 4096)
    assert payload['model'] == 'gpt-6-luna' and payload['max_output_tokens'] == 4096
    assert payload['instructions'] == 'You are a manga translator.'
    assert 'temperature' not in payload                      # current reasoning models reject it
    assert [m['role'] for m in payload['input']] == ['user', 'assistant', 'user']
    assert payload['input'][1]['content'] == 'ตัวอย่าง'        # chat samples stay plain text
    image, text = payload['input'][2]['content']
    assert image == {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,AAA'}
    assert text['type'] == 'input_text' and text['text'].endswith('1. I am glad.')


def test_the_response_maps_back_onto_the_fields_the_translator_reads():
    data = {
        'status': 'completed',
        'output': [{'type': 'reasoning', 'content': []},
                   {'type': 'message', 'content': [
                       {'type': 'output_text', 'text': 'ดีใจจัง'},
                       {'type': 'output_text', 'text': '\nดีใจด้วย'}]}],
        'usage': {'input_tokens': 1234, 'output_tokens': 12},
    }
    response = from_responses(data)
    assert response.choices[0].message.content == 'ดีใจจัง\nดีใจด้วย'
    assert response.choices[0].finish_reason == 'stop'
    assert response.usage.prompt_tokens == 1234 and response.usage.total_tokens == 1246


def test_an_incomplete_answer_keeps_its_reason_so_the_retry_loop_sees_it():
    data = {'status': 'incomplete', 'incomplete_details': {'reason': 'max_output_tokens'},
            'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'ดีใจ'}]}]}
    assert from_responses(data).choices[0].finish_reason == 'max_output_tokens'
