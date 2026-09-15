"use client";

import React, { useRef, useState, useEffect } from 'react';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        // Request camera access
        async function setupCamera() {
            try {
                // If over insecure HTTP network IP, mediaDevices is entirely undefined
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Browser camera API disabled via insecure local network context.');
                }

                let mediaStream;
                try {
                    // Try to get the rear/environment camera first (for mobile)
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                } catch (firstErr) {
                    // If rear camera isn't available (like on desktop PCs), fall back to ANY default camera instantly
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: true
                    });
                }

                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err: any) {
                // If over insecure HTTP network IP, mediaDevices is entirely undefined
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setError('Browser camera API disabled via insecure local network context.');
                } else {
                    setError(err.message || 'Unable to access camera. Please check permissions.');
                }
            }
        }

        setupCamera();

        return () => {
            // Cleanup stream on unmount
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw the current video frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to file
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                // Stop all tracks before propagating the captured file
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                onCapture(file);
            }
        }, 'image/jpeg', 0.9);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#000',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            {error ? (
                <div style={{ color: 'white', textAlign: 'center', padding: '2rem' }}>
                    <p style={{ marginBottom: '2rem', color: '#f87171', maxWidth: '400px' }}>
                        {error}
                        <br /><br />
                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Please use the native camera fallback below to continue capturing.</span>
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button onClick={onCancel} className="btn-secondary" style={{ backgroundColor: 'white', color: 'black' }}>
                            Go Back
                        </button>
                        <label
                            style={{
                                background: '#1cc686',
                                color: 'white',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-block'
                            }}
                        >
                            Open Native Camera
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        onCapture(e.target.files[0]);
                                    }
                                }}
                            />
                        </label>
                    </div>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <div style={{
                        position: 'absolute',
                        bottom: '40px',
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '2rem',
                        padding: '0 2rem'
                    }}>
                        <button
                            onClick={onCancel}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '1rem 2rem',
                                borderRadius: '99px',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCapture}
                            style={{
                                background: '#1cc686',
                                border: 'none',
                                color: 'white',
                                padding: '1rem 2rem',
                                borderRadius: '99px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(28, 198, 134, 0.4)'
                            }}
                        >
                            📸 Snap Photo
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
