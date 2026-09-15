"use client";

import { useState, useRef, useEffect } from "react";
import { assessImage } from "@/features/assessment/api";
import { compressImage } from "@/lib/image-compression";
import { ApiErrorPanel } from "./ApiErrorPanel";
import CameraCapture from "./CameraCapture";

interface ImageUploaderProps {
    assessmentId: string;
    onComplete: () => void;
}

export function ImageUploader({ assessmentId, onComplete }: ImageUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);
    const [showCamera, setShowCamera] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Clean up object URL when component unmounts
    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        // Client-side validation
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(selected.type)) {
            setError({ message: "Invalid file type. Please upload a JPEG, PNG, or WebP image." });
            return;
        }

        if (selected.size > 10 * 1024 * 1024) { // Changed to 10MB per mockup
            setError({ message: "File is too large. Image must be under 10MB." });
            return;
        }

        setError(null);
        setFile(selected);
        const objectUrl = URL.createObjectURL(selected);
        setPreview(objectUrl);
    };

    const clearSelection = () => {
        setError(null);
        setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const compressedFile = await compressImage(file, 1024, 1024, 0.85);
            await assessImage(assessmentId, compressedFile);
            onComplete(); // Successfully uploaded
        } catch (err: any) {
            if (err?.code === "ASSESSMENT_NOT_FOUND") {
                sessionStorage.removeItem("assessment_id");
                alert("Your session expired. Please start a new assessment.");
                window.location.href = "/";
            } else {
                setError(err);
                setLoading(false);
            }
        }
    };

    return (
        <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
            {showCamera && (
                <CameraCapture
                    onCapture={(capturedFile) => {
                        setShowCamera(false);
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(capturedFile);
                        handleFileChange({ target: { files: dataTransfer.files } } as any);
                    }}
                    onCancel={() => setShowCamera(false)}
                />
            )}

            <ApiErrorPanel error={error} onRetry={error?.retryable ? handleUpload : undefined} />

            {!preview ? (
                <div>
                    <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2.8rem", color: "#111827", marginBottom: "1rem", letterSpacing: "-0.02em" }}>Upload or Capture a Skin Image</h1>
                    <p style={{ fontSize: "1.2rem", color: "#4b5563", marginBottom: "3rem" }}>Take a clear, well-lit photo of the affected area.</p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
                        {/* Take a Photo card */}
                        <div
                            onClick={() => setShowCamera(true)}
                            style={{
                                position: "relative",
                                overflow: "hidden",
                                background: "#eef6ff",
                                border: "1px solid #dbeafe",
                                borderRadius: "24px",
                                padding: "3rem 1.5rem",
                                textAlign: "center",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ background: "#4f8cf6", width: "72px", height: "72px", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", position: "relative", zIndex: 1 }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </div>
                            <h3 style={{ fontSize: "1.3rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem", position: "relative", zIndex: 1 }}>Take a Photo</h3>
                            <p style={{ color: "#6b7280", fontSize: "0.95rem", position: "relative", zIndex: 1 }}>Use device camera</p>
                        </div>

                        {/* Upload Image card */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                background: "#fafafa",
                                border: "2px dashed #e5e7eb",
                                borderRadius: "24px",
                                padding: "3rem 1.5rem",
                                textAlign: "center",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ background: "#d1fae5", width: "72px", height: "72px", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                            </div>
                            <h3 style={{ fontSize: "1.3rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>Upload Image</h3>
                            <p style={{ color: "#6b7280", fontSize: "0.95rem" }}>JPG, PNG · Max 10MB</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} />
                        </div>
                    </div>

                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "24px", padding: "2.5rem", background: "white", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                        <h4 style={{ color: "#6b7280", fontWeight: 600, fontSize: "0.9rem", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 1.5rem 0" }}>IMAGE QUALITY TIPS</h4>
                        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "1.5rem", padding: 0, margin: 0 }}>
                            {[
                                "Use good natural or indoor lighting",
                                "Keep the camera focused and steady",
                                "Show the affected area clearly in frame",
                                "Avoid filters or heavy post-processing",
                                "Only upload images of your own skin"
                            ].map(tip => (
                                <li key={tip} style={{ display: "flex", alignItems: "center", gap: "1rem", color: "#374151", fontSize: "1.1rem" }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f8cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="glass-panel animated" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem" }}>
                    <h3 className="title">Review Image</h3>
                    <img
                        src={preview}
                        alt="Skin concern preview"
                        style={{
                            maxWidth: "100%",
                            maxHeight: "350px",
                            borderRadius: "16px",
                            objectFit: "cover",
                            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                            margin: "1.5rem 0"
                        }}
                    />
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <button className="btn-secondary" onClick={clearSelection} disabled={loading}>
                            Select Different Image
                        </button>
                        <button className="btn-primary" onClick={handleUpload} disabled={loading || !file}>
                            {loading ? "Analyzing..." : "Submit Photo"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
