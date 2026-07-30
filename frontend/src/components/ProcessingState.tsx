'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';

const recommendationStages = [
  'Reviewing your answers',
  'Applying safety rules',
  'Preparing your guidance',
];
const assessmentStages = [
  'Validating image quality',
  'Removing image metadata',
  'Reading visual patterns',
];

export function ProcessingState({
  mode = 'recommendation',
}: {
  mode?: 'assessment' | 'recommendation';
}) {
  const stages = mode === 'assessment' ? assessmentStages : recommendationStages;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStage((current) => Math.min(current + 1, stages.length - 1)),
      1400,
    );
    return () => window.clearInterval(timer);
  }, [stages.length]);

  return (
    <section className="ss-card overflow-hidden" aria-live="polite">
      <div className="grid min-h-[28rem] place-items-center p-6 sm:p-10">
        <div className="w-full max-w-lg text-center">
          <div className="relative mx-auto h-24 w-24">
            <span className="absolute inset-0 rounded-full border border-moss/30 [animation:ss-pulse-ring_1.8s_ease-out_infinite]" />
            <span className="absolute inset-2 rounded-full border border-moss/20 [animation:ss-pulse-ring_1.8s_.45s_ease-out_infinite]" />
            <span className="absolute inset-4 grid place-items-center rounded-full bg-forest text-white shadow-brand">
              <Icon
                name={mode === 'assessment' ? 'sparkles' : 'shield'}
                className="h-7 w-7"
              />
            </span>
          </div>

          <p className="ss-kicker mt-7">
            {mode === 'assessment' ? 'Multimodal assessment' : 'Safety-shaped recommendation'}
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.025em] text-forest">
            {stages[stage]}
            <span className="text-coral">…</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-forest/58">
            {mode === 'assessment'
              ? 'The image is sanitized before the AI reads controlled visual patterns. It is not stored after this request.'
              : 'A separate AI invocation is combining the preliminary findings and your answers within backend-owned safety limits.'}
          </p>

          <ol className="mx-auto mt-8 grid max-w-md gap-2 text-left">
            {stages.map((item, index) => (
              <li
                key={item}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  index === stage
                    ? 'bg-sage/65 font-bold text-forest'
                    : index < stage
                      ? 'text-moss'
                      : 'text-forest/35'
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    index < stage
                      ? 'bg-moss text-white'
                      : index === stage
                        ? 'border-2 border-moss bg-white text-moss'
                        : 'border border-forest/15 bg-white'
                  }`}
                >
                  {index < stage ? (
                    <Icon name="check" className="h-3.5 w-3.5" />
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full ${index === stage ? 'bg-moss' : 'bg-forest/20'}`} />
                  )}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="border-t border-forest/8 bg-mist/60 px-6 py-4 text-center text-xs text-forest/45">
        This can take a moment. Please keep this page open.
      </div>
    </section>
  );
}
