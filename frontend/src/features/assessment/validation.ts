import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_SIZE_LABEL } from '@/lib/constants';

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return 'Please choose a JPG, PNG, or WebP image.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `Please choose an image smaller than ${MAX_IMAGE_SIZE_LABEL}.`;
  }

  return null;
}

export function getAllowedImageDescription(): string {
  return `${ACCEPTED_IMAGE_TYPES.join(', ')} up to ${MAX_IMAGE_SIZE_LABEL}`;
}
