'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icons';
import { ACCEPTED_IMAGE_ATTR, MAX_IMAGE_SIZE_LABEL } from '@/lib/constants';
import {
  getAllowedImageDescription,
  validateImageFile,
} from '@/features/assessment/validation';

export interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  onValidationError: (message: string) => void;
  disabled?: boolean;
}

export function ImageUploader({
  onFileSelected,
  onValidationError,
  disabled = false,
}: ImageUploaderProps) {
  const [hasConsent, setHasConsent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputDisabled = disabled || !hasConsent;

  function processFile(file?: File) {
    if (!file) return;
    if (!hasConsent) {
      onValidationError('Confirm image consent before choosing a photo.');
      return;
    }
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      onValidationError(validationMessage);
      return;
    }
    onFileSelected(file);
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    processFile(event.target.files?.[0]);
    event.target.value = '';
  }

  return (
    <section className="ss-card overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_19rem]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex items-start gap-4">
            <span className="ss-icon-box">
              <Icon name="camera" className="h-5 w-5" />
            </span>
            <div>
              <p className="ss-kicker">Image capture</p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-forest sm:text-2xl">
                Add one clear skin image
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-forest/60">
                Use even lighting, keep the affected area in focus, and avoid filters or heavy zoom.
              </p>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-forest/10 bg-mist/70 p-4 transition hover:border-moss/25">
            <input
              type="checkbox"
              checked={hasConsent}
              onChange={(event) => setHasConsent(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-forest/25 accent-moss"
            />
            <span>
              <span className="block text-sm font-bold text-forest">
                I have permission to use this image
              </span>
              <span className="mt-1 block text-xs leading-5 text-forest/55">
                The image will be processed for this assessment and is not retained by the backend.
              </span>
            </span>
          </label>

          <div
            onDragEnter={(event) => {
              event.preventDefault();
              if (hasConsent) setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              processFile(event.dataTransfer.files?.[0]);
            }}
            className={`mt-5 rounded-[24px] border border-dashed p-5 transition sm:p-7 ${
              isDragging
                ? 'border-moss bg-sage/70'
                : hasConsent
                  ? 'border-moss/35 bg-sage/20'
                  : 'border-forest/12 bg-forest/[0.02]'
            }`}
          >
            <div className="text-center">
              <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${hasConsent ? 'bg-moss text-white' : 'bg-forest/8 text-forest/35'}`}>
                <Icon name="upload" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-forest">
                {hasConsent ? 'Drop a photo here or choose an option' : 'Confirm consent to continue'}
              </p>
              <p className="mt-1 text-xs text-forest/45">
                {getAllowedImageDescription()} · up to {MAX_IMAGE_SIZE_LABEL}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label
                className={`ss-button-secondary ${inputDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
              >
                <Icon name="file" className="h-4 w-4" />
                Choose from device
                <input
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_IMAGE_ATTR}
                  onChange={handleInput}
                  disabled={inputDisabled}
                />
              </label>

              <label
                className={`ss-button-accent ${inputDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
              >
                <Icon name="camera" className="h-4 w-4" />
                Open camera
                <input
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_IMAGE_ATTR}
                  capture="environment"
                  onChange={handleInput}
                  disabled={inputDisabled}
                />
              </label>
            </div>
          </div>
        </div>

        <aside className="border-t border-forest/8 bg-mist/60 p-5 sm:p-7 lg:border-l lg:border-t-0">
          <p className="text-sm font-bold text-forest">For the clearest result</p>
          <ul className="mt-5 space-y-4">
            {[
              ['Use daylight', 'Avoid harsh flash and deep shadows.'],
              ['Show one concern', 'Keep unrelated areas outside the frame.'],
              ['Stay in focus', 'Hold steady and keep skin texture visible.'],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-moss shadow-sm">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-xs font-bold text-forest">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-forest/50">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-3 rounded-2xl border border-moss/10 bg-white/70 p-3">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
            <p className="text-[11px] leading-5 text-forest/55">
              File names, metadata, and image bytes are not stored in assessment records.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
