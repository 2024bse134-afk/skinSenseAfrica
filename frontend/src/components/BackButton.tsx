"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BackButton() {
    const pathname = usePathname();

    if (pathname === '/') return null;

    return (
        <div style={{ maxWidth: '800px', margin: '2rem auto 0', padding: '0 1rem', width: '100%' }}>
            <Link href="/" style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: '#6b7280',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
                padding: '0.5rem 0'
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                    <path d="M19 12H5"></path>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Go Back
            </Link>
        </div>
    );
}
