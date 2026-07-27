import { API_BASE_URL } from './constants';
import type { BackendErrorDetails } from '@/features/assessment/types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: unknown;

  constructor(message: string, options: { status: number; code: string; retryable: boolean; details: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.startsWith('/')) {
    return `${API_BASE_URL}${normalizedPath}`;
  }
  return new URL(normalizedPath, API_BASE_URL).toString();
}

async function parseError(response: Response): Promise<ApiClientError> {
  const fallback = {
    status: response.status,
    code: 'HTTP_ERROR',
    retryable: response.status >= 500,
    details: null,
    message: `Request failed with status ${response.status}`,
  };

  try {
    const payload = (await response.json()) as Partial<BackendErrorDetails> | null;
    const error = payload?.error;
    if (error && typeof error.code === 'string' && typeof error.message === 'string') {
      return new ApiClientError(error.message, {
        status: response.status,
        code: error.code,
        retryable: Boolean(error.retryable),
        details: error.details ?? null,
      });
    }
  } catch {
    // Fall through to the generic error below.
  }

  return new ApiClientError(fallback.message, fallback);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      cache: 'no-store',
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiClientError('Unable to reach the assessment service. Please check your connection and try again.', {
      status: 0, code: 'NETWORK_ERROR', retryable: true, details: null,
    });
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    body: formData,
  });
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' });
}
