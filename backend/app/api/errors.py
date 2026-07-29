"""Stable API error envelope and exception handlers."""

from __future__ import annotations

from enum import Enum
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode(str, Enum):
    INVALID_IMAGE_TYPE = "INVALID_IMAGE_TYPE"
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
    IMAGE_DECODE_FAILED = "IMAGE_DECODE_FAILED"
    IMAGE_QUALITY_INSUFFICIENT = "IMAGE_QUALITY_INSUFFICIENT"
    ASSESSMENT_PROVIDER_UNAVAILABLE = "ASSESSMENT_PROVIDER_UNAVAILABLE"
    ASSESSMENT_TIMEOUT = "ASSESSMENT_TIMEOUT"
    ASSESSMENT_OUTPUT_INVALID = "ASSESSMENT_OUTPUT_INVALID"
    RECOMMENDATION_BLOCKED = "RECOMMENDATION_BLOCKED"
    RED_FLAG_ESCALATION_REQUIRED = "RED_FLAG_ESCALATION_REQUIRED"
    ASSESSMENT_NOT_FOUND = "ASSESSMENT_NOT_FOUND"
    ASSESSMENT_STATE_CONFLICT = "ASSESSMENT_STATE_CONFLICT"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    RECOMMENDATION_UNAVAILABLE = "RECOMMENDATION_UNAVAILABLE"


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: ErrorCode
    message: str = Field(min_length=1, max_length=240)
    retryable: bool
    details: dict = Field(default_factory=dict)
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class APIError(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode | str,
        message: str,
        *,
        retryable: bool = False,
        details: dict | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = ErrorCode(code)
        self.message = message
        self.retryable = retryable
        self.details = details or {}


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", uuid4()))


def _response(request: Request, error: APIError) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorDetail(
            code=error.code,
            message=error.message,
            retryable=error.retryable,
            details=error.details,
            request_id=_request_id(request),
        )
    )
    return JSONResponse(status_code=error.status_code, content=payload.model_dump(mode="json"))


def install_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(APIError)
    async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
        return _response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = [
            {
                "path": ".".join(str(part) for part in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _response(
            request,
            APIError(
                422,
                ErrorCode.VALIDATION_ERROR,
                "The request failed validation.",
                details={"fields": fields},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = (
            ErrorCode.ASSESSMENT_NOT_FOUND
            if exc.status_code == 404
            else ErrorCode.VALIDATION_ERROR
        )
        message = "Resource not found." if exc.status_code == 404 else "The request could not be completed."
        return _response(request, APIError(exc.status_code, code, message))

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
        _ = exc
        return _response(
            request,
            APIError(
                500,
                ErrorCode.INTERNAL_ERROR,
                "An internal error occurred.",
                retryable=True,
            ),
        )
