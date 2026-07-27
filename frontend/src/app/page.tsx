'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAssessment } from '@/features/assessment/api';
import { ApiClientError } from '@/lib/api-client';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

export default function LandingPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartAssessment() {
    setIsStarting(true);
    setError(null);
    try {
      const response = await createAssessment();
      window.sessionStorage.setItem('skinsense:assessment_id', response.id);
      router.push(`/assessment/${response.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : 'Unable to start assessment right now.');
      setIsStarting(false);
    }
  }

  return <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12"><div className="ss-shell space-y-6">
    <section className="space-y-6 py-3 sm:py-8">
      <div className="inline-flex rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-teal-800">{APP_NAME}</div>
      <div className="max-w-2xl space-y-4"><h1 className="text-4xl font-semibold tracking-[-.035em] text-[#153d43] sm:text-5xl">Skin screening that explains, educates, and flags risk early.</h1><p className="max-w-xl text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">{APP_TAGLINE} This tool is educational only. It does not diagnose, prescribe, or replace a qualified clinician.</p></div>
      <div className="ss-card overflow-hidden"><div className="grid divide-y divide-[#dbe6e3] sm:grid-cols-2 sm:divide-x sm:divide-y-0"><div className="p-6"><h2 className="text-base font-semibold text-[#153d43]">What it does</h2><p className="mt-2 text-sm leading-6 text-slate-700">It uses an image plus a short questionnaire to classify a likely condition and guide next steps.</p></div><div className="p-6"><h2 className="text-base font-semibold text-[#153d43]">What it does not do</h2><p className="mt-2 text-sm leading-6 text-slate-700">It cannot confirm a diagnosis or rule out emergencies. Seek professional care for worsening, painful, or concerning symptoms.</p></div></div></div>
      <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-6 text-sm leading-6 text-slate-700"><p className="font-semibold text-[#153d43]">Privacy note</p><p className="mt-2">Your image is treated as temporary session data for the V1 assessment flow and is not intended for long-term storage in this phase.</p></div>
      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <button type="button" onClick={handleStartAssessment} disabled={isStarting} className="ss-primary-button inline-flex w-full items-center justify-center px-6 text-base font-semibold sm:w-auto sm:min-w-56">{isStarting ? 'Starting assessment…' : 'Start assessment'}</button>
    </section>
    <aside className="ss-card p-6"><p className="text-base font-semibold text-[#153d43]">Designed for mobile</p><p className="mt-2 text-sm leading-6 text-slate-700">Capture a well-lit photo, review it, and move into the assessment flow without needing a desktop.</p><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700"><li>• Clear consent and plain-language explanation before the camera opens.</li><li>• Simple image upload and review with retake/replace options.</li><li>• Backend error messages surfaced in a readable way.</li></ul></aside>
  </div></main>;
}
