'use client';

import { useEffect, useState } from 'react';

const recommendationStages = ['Reviewing your answers…', 'Applying safety rules…', 'Preparing educational guidance…'];
const assessmentStages = ['Validating your image…', 'Removing image metadata…', 'Preparing a preliminary assessment…'];

export function ProcessingState({ mode = 'recommendation' }: { mode?: 'assessment' | 'recommendation' }) {
  const stages = mode === 'assessment' ? assessmentStages : recommendationStages;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 1200);
    return () => window.clearInterval(timer);
  }, [stages.length]);
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft" aria-live="polite"><div className="flex items-start gap-4"><div className="mt-1 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-moss" /><div><h2 className="text-lg font-semibold text-ink">{stages[stage]}</h2><p className="mt-2 text-sm leading-6 text-slate-600">We are preparing educational guidance from the information you provided. This does not confirm a diagnosis.</p></div></div><ol className="mt-6 space-y-2 text-sm text-slate-600">{stages.map((item, index) => <li key={item} className={index <= stage ? 'font-medium text-moss' : ''}>{index <= stage ? '✓' : '○'} {item}</li>)}</ol></section>;
}
