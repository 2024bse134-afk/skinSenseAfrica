const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://skinsense-backend-240757536793.us-central1.run.app";

function buildUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

export class ApiClientError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: string,
        public readonly retryable: boolean,
        public readonly details: unknown,
        public readonly requestId?: string,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

export async function apiRequest<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(buildUrl(path), {
            ...init,
            cache: "no-store",
            headers: {
                Accept: "application/json",
                ...(init.headers ?? {}),
            },
        });
    } catch (error) {
        console.error("Network Fetch Error", error);
        throw new ApiClientError(
            "Unable to reach the server.",
            0,
            "NETWORK_ERROR",
            true,
            {},
        );
    }

    if (!response.ok) {
        let errorResponse;
        try {
            errorResponse = await response.json();
        } catch {
            throw new ApiClientError(
                "Invalid response from server.",
                response.status,
                "INVALID_JSON",
                false,
                {},
            );
        }

        const error = errorResponse.error || {};

        throw new ApiClientError(
            error.message || `An error occurred (${response.status})`,
            response.status,
            error.code || "UNKNOWN_ERROR",
            error.retryable ?? false,
            error.details,
            error.request_id,
        );
    }

    if (response.status === 204) {
        return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
}
