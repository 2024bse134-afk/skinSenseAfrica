export const APP_NAME = 'SkinSense Africa';
export const APP_TAGLINE = 'Educational skin screening for melanin-rich skin tones.';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '/api';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_IMAGE_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_SIZE_LABEL = '8 MB';
