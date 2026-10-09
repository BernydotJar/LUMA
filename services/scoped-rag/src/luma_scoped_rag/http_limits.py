"""ASGI request bound enforced before FastAPI JSON/Pydantic parsing."""
from __future__ import annotations

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_SEARCH_REQUEST_BYTES = 8192


class SearchBodyLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") != "/v1/search":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0").decode("ascii"))
            if declared < 0:
                raise ValueError("negative Content-Length")
        except (UnicodeDecodeError, ValueError):
            await JSONResponse({"detail": "invalid_request_length"}, status_code=400)(
                scope, receive, send
            )
            return
        if declared > MAX_SEARCH_REQUEST_BYTES:
            await JSONResponse({"detail": "request_too_large"}, status_code=413)(
                scope, receive, send
            )
            return

        # Read at most 8 KiB of the body *before* handing it to the framework.
        # This catches HTTP/1.1 chunked requests lacking Content-Length and
        # avoids FastAPI swallowing body-size errors as generic JSON parse 400s.
        chunks: list[Message] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            total += len(message.get("body", b""))
            if total > MAX_SEARCH_REQUEST_BYTES:
                await JSONResponse({"detail": "request_too_large"}, status_code=413)(
                    scope, receive, send
                )
                return
            chunks.append(message)
            if not message.get("more_body", False):
                break

        async def replay_receive() -> Message:
            if chunks:
                return chunks.pop(0)
            return await receive()

        await self.app(scope, replay_receive, send)
