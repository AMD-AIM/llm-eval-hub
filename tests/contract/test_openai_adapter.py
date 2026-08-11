import httpx
import pytest

from packages.eval_engine.adapters import OpenAICompatibleAdapter
from packages.eval_engine.contracts import ModelRequest
from tests.fixtures.mock_openai import app


def request(content: str) -> ModelRequest:
    return ModelRequest(
        request_id="r1",
        model="mock-intent-v1",
        mode="chat_completions",
        messages=[{"role": "user", "content": content}],
        prompt=None,
        params={"temperature": 0, "max_tokens": 8},
    )


@pytest.mark.asyncio
async def test_adapter_extracts_text_and_usage() -> None:
    transport = httpx.ASGITransport(app=app)
    adapter = OpenAICompatibleAdapter(base_url="http://test/v1", transport=transport, max_retries=0)

    result = await adapter.infer(request("如何申请退款？"))

    assert result.output_text == "billing"
    assert result.error_type is None
    assert result.prompt_tokens is not None
    assert len(result.attempt_traces) == 1


@pytest.mark.asyncio
async def test_adapter_classifies_and_retries_429() -> None:
    transport = httpx.ASGITransport(app=app)
    adapter = OpenAICompatibleAdapter(base_url="http://test/v1", transport=transport, max_retries=1)

    result = await adapter.infer(request("[http:429]"))

    assert result.error_type == "http.429"
    assert result.attempts == 2
    assert all(trace.error_type == "http.429" for trace in result.attempt_traces)


@pytest.mark.asyncio
async def test_adapter_keeps_invalid_json_separate_from_model_error() -> None:
    transport = httpx.ASGITransport(app=app)
    adapter = OpenAICompatibleAdapter(base_url="http://test/v1", transport=transport, max_retries=0)

    result = await adapter.infer(request("[invalid-json]"))

    assert result.error_type == "response.invalid_json"
    assert result.output_text is None
