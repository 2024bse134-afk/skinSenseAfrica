import React from "react";

interface ApiErrorPanelProps {
    error: any;
    onRetry?: () => void;
}

export function ApiErrorPanel({ error, onRetry }: ApiErrorPanelProps) {
    if (!error) return null;

    return (
        <div className="alert-error animated">
            <h3 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Something went wrong</h3>
            <p>{error.message || "An unexpected error occurred."}</p>

            {error.requestId && (
                <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.5rem", fontFamily: "monospace" }}>
                    Request ID: {error.requestId}
                </p>
            )}

            {error.retryable && onRetry && (
                <button
                    className="btn-secondary"
                    onClick={onRetry}
                    style={{ marginTop: "1rem", fontSize: "0.9rem", padding: "0.5rem 1rem" }}
                >
                    Try Again
                </button>
            )}
        </div>
    );
}
