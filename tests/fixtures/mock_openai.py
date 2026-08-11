from __future__ import annotations

import asyncio
import re
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Eval Hub Mock OpenAI")


class ChatRequest(BaseModel):
    model: str
    messages: list[dict[str, Any]]
    temperature: float = 0
    max_tokens: int = 32
    stream: bool = False
    seed: int | None = None
    stop: list[str] = Field(default_factory=list)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
def models(request: Request) -> dict[str, Any]:
    if request.headers.get("authorization") == "Bearer reject-me":
        raise HTTPException(status_code=401, detail="invalid key")
    return {
        "object": "list",
        "data": [{"id": "mock-intent-v1", "object": "model", "owned_by": "evalhub"}],
    }


def _intent(text: str) -> str:
    billing = ["信用卡", "扣", "发票", "金额", "退款", "套餐", "续费", "价格"]
    technical = ["502", "超时", "页面", "空白", "接口", "上传", "错误"]
    account = ["邮箱", "账号", "团队成员", "两步验证", "登录"]
    if any(keyword in text for keyword in billing):
        return "billing"
    if any(keyword in text for keyword in technical):
        return "technical"
    if any(keyword in text for keyword in account):
        return "account"
    return "OK"


@app.post("/v1/chat/completions")
async def chat(payload: ChatRequest):
    text = "\n".join(str(message.get("content", "")) for message in payload.messages)
    if "[http:401]" in text:
        raise HTTPException(status_code=401, detail="forced")
    if "[http:429]" in text:
        raise HTTPException(status_code=429, detail="forced", headers={"Retry-After": "0.01"})
    if "[http:500]" in text:
        raise HTTPException(status_code=500, detail="forced")
    if "[invalid-json]" in text:
        return PlainTextResponse("not-json", media_type="application/json")
    delay = re.search(r"\[delay:(\d+(?:\.\d+)?)\]", text)
    if delay:
        await asyncio.sleep(float(delay.group(1)))
    answer = "" if "[empty]" in text else _intent(text)
    prompt_tokens = max(1, len(text) // 4)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": payload.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": answer},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": 1,
            "total_tokens": prompt_tokens + 1,
        },
    }
