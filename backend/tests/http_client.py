"""Thread-free ASGI test client for the execution environment."""

from __future__ import annotations

import asyncio

import httpx2

from app.main import app


class ASGITestClient:
    def request(self, method: str, path: str, **kwargs):
        async def execute():
            transport = httpx2.ASGITransport(app=app)
            async with httpx2.AsyncClient(
                transport=transport,
                base_url="http://testserver",
            ) as client:
                return await client.request(method, path, **kwargs)

        return asyncio.run(execute())

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs):
        return self.request("PUT", path, **kwargs)

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)


def async_dependency(value):
    async def dependency():
        return value

    return dependency
