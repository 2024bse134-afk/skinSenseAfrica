import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import { Icon } from './Icons';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex flex-col focus-visible:outline-none"
      aria-label={`${APP_NAME} home`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border-2 border-primary text-primary transition-transform group-hover:-rotate-3 group-hover:scale-[1.03]">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <span className="text-xl font-display font-bold leading-none text-ink">
          SkinSense Africa
        </span>
      </div>
      {!compact ? (
        <span className="ml-[40px] block text-xs text-forest/70">
          Smarter skin health guidance
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
  return (
    <header className="sticky top-0 z-30 border-b border-forest/8 bg-cream/85 backdrop-blur-xl">
      <div className="ss-container flex h-20 items-center justify-between gap-4">
        <Brand />
        {!step ? (
          <nav aria-label="Main Navigation" className="hidden items-center gap-8 md:flex text-sm font-semibold text-forest/70">
            <Link href="/" className="hover:text-forest transition-colors">Home</Link>
            <Link href="#how-it-works" className="hover:text-forest transition-colors">How It Works</Link>
            <Link href="/my-assessments" className="hover:text-forest transition-colors">My Assessments</Link>
            <Link href="/safety" className="hover:text-forest transition-colors">Safety & Limitations</Link>
          </nav>
        ) : null}
        <div className="flex min-w-10 justify-end">
          {action || (
            <Link href="/assessment" className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
              Start Screening
            </Link>
          )}
        </div>
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
