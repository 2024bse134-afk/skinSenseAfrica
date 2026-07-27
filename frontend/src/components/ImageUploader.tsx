'use client';

import { ACCEPTED_IMAGE_ATTR, MAX_IMAGE_SIZE_LABEL } from '@/lib/constants';
import { getAllowedImageDescription, validateImageFile } from '@/features/assessment/validation';

export interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  onValidationError: (message: string) => void;
  disabled?: boolean;
}

function handleSelection(
  event: React.ChangeEvent<HTMLInputElement>,
  onFileSelected: (file: File) => void,
  onValidationError: (message: string) => void,
) {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (!file) {
    return;
  }

  const validationMessage = validateImageFile(file);
  if (validationMessage) {
    onValidationError(validationMessage);
    return;
  }

  onFileSelected(file);
}

export function ImageUploader({ onFileSelected, onValidationError, disabled = false }: ImageUploaderProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Add a skin image</h2>
          <p className="mt-1 text-sm text-slate-600">
            Good lighting, a steady hand, and a focused image help the classifier work better.
            Avoid filters, shadows, and heavy zoom. Accepted formats: {getAllowedImageDescription()}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-100">
            <span>Choose file</span>
            <input
              className="hidden"
              type="file"
              accept={ACCEPTED_IMAGE_ATTR}
              onChange={(event) => handleSelection(event, onFileSelected, onValidationError)}
              disabled={disabled}
            />
          </label>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-ink transition hover:bg-amber-100">
            <span>Use camera</span>
            <input
              className="hidden"
              type="file"
              accept={ACCEPTED_IMAGE_ATTR}
              capture="environment"
              onChange={(event) => handleSelection(event, onFileSelected, onValidationError)}
              disabled={disabled}
            />
          </label>
        </div>

        <p className="text-xs text-slate-500">
          Keep the image under {MAX_IMAGE_SIZE_LABEL} and make sure the affected area is clearly visible.
        </p>
      </div>
    </section>
  );
}
