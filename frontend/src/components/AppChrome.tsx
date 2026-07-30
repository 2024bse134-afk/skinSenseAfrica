import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import { Icon } from './Icons';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none"
      aria-label={`${APP_NAME} home`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-forest text-white shadow-brand transition-transform group-hover:-rotate-3 group-hover:scale-[1.03]">
        <Icon name="leaf" className="h-5 w-5" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-[15px] font-bold leading-none tracking-[-0.02em] text-forest">
            SkinSense
          </span>
          <span className="mt-1 block text-[10px] font-bold uppercase leading-none tracking-[0.24em] text-moss">
            Africa
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export function AppHeader({
  step,
  action,
}: {
  step?: 'image' | 'questions' | 'results';
  action?: React.ReactNode;
}) {
  const steps = [
    { id: 'image', label: 'Image' },
    { id: 'questions', label: 'Questions' },
    { id: 'results', label: 'Guidance' },
  ] as const;
  const activeIndex = step ? steps.findIndex((item) => item.id === step) : -1;

  return (
    <header className="sticky top-0 z-30 border-b border-forest/8 bg-cream/85 backdrop-blur-xl">
      <div className="ss-container flex h-[72px] items-center justify-between gap-4">
        <Brand />
        {step ? (
          <nav aria-label="Assessment progress" className="hidden items-center md:flex">
            {steps.map((item, index) => (
              <div key={item.id} className="flex items-center">
                {index > 0 ? (
                  <span
                    className={`mx-2 h-px w-8 lg:w-12 ${
                      index <= activeIndex ? 'bg-moss' : 'bg-forest/15'
                    }`}
                  />
                ) : null}
                <span
                  className={`inline-flex items-center gap-2 text-xs font-bold ${
                    index === activeIndex
                      ? 'text-forest'
                      : index < activeIndex
                        ? 'text-moss'
                        : 'text-forest/40'
                  }`}
                  aria-current={index === activeIndex ? 'step' : undefined}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${
                      index < activeIndex
                        ? 'bg-moss text-white'
                        : index === activeIndex
                          ? 'bg-forest text-white'
                          : 'border border-forest/15 bg-white'
                    }`}
                  >
                    {index < activeIndex ? (
                      <Icon name="check" className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {item.label}
                </span>
              </div>
            ))}
          </nav>
        ) : null}
        <div className="flex min-w-10 justify-end">{action}</div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-forest/10 bg-white/40">
      <div className="ss-container flex flex-col gap-3 py-7 text-xs leading-5 text-forest/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 SkinSense Africa · AI engineering showcase</p>
        <p className="inline-flex items-center gap-2">
          <Icon name="shield" className="h-4 w-4 text-moss" />
          Educational only · Not a diagnosis
        </p>
      </div>
    </footer>
  );
}

export function MobileJourney({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-5 flex items-center gap-3 md:hidden" aria-label={`Step ${step} of 3`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss">
        Step {step} of 3
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest/10">
        <span
          className="block h-full rounded-full bg-moss transition-[width]"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </span>
    </div>
  );
}
