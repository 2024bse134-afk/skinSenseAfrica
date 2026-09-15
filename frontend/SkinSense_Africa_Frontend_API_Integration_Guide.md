# SkinSense Africa — Frontend API Integration Guide

**Backend API:** https://skinsense-backend-240757536793.us-central1.run.app  
**Health Check:** https://skinsense-backend-240757536793.us-central1.run.app/health  
**Swagger / OpenAPI Docs:** https://skinsense-backend-240757536793.us-central1.run.app/docs

**Document version:** 1.0  
**Audience:** Frontend engineers, mobile engineers, QA engineers, and UI/UX teams  
**Backend:** FastAPI on Google Cloud Run  
**Assessment engine:** Cortex AI Gateway using a Gemini-compatible multimodal API

---

## 1. Purpose

This document is the implementation guide for any SkinSense Africa web or mobile frontend consuming the deployed guarded assessment backend.

The backend supports:

- image upload and validation;
- preliminary AI-assisted image assessment;
- structured symptom collection;
- deterministic safety checks;
- educational recommendations for routine cases;
- professional-review, urgent, and emergency escalation paths;
- assessment retrieval and workflow resumption;
- prototype referral requests.

The frontend must preserve the backend-defined workflow and safety rules.

> **Important:** SkinSense provides a preliminary AI-assisted assessment. It is not a confirmed medical diagnosis and must not be presented as one.

The generated OpenAPI document at the Swagger URL is the machine-readable authority. This guide explains how the frontend should behave.

---

## 2. Backend URLs

### Production API base URL

```text
https://skinsense-backend-240757536793.us-central1.run.app
```

For a hosted frontend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://skinsense-backend-240757536793.us-central1.run.app
```

### Health endpoint

```text
https://skinsense-backend-240757536793.us-central1.run.app/health
```

### Swagger documentation

```text
https://skinsense-backend-240757536793.us-central1.run.app/docs
```

### Local development

Where the existing Next.js rewrite is used:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api
```

The local rewrite should forward `/api/*` to the local FastAPI server.

---

## 3. Request Conventions

- Use HTTPS outside local development.
- Send `Accept: application/json`.
- Send `Content-Type: application/json` for JSON requests.
- Do **not** manually set `Content-Type` when sending `FormData`; the browser must add the multipart boundary.
- Use `cache: "no-store"` for assessment requests.
- Do not cache medical assessment responses in service workers or CDN layers.
- The backend currently has no authentication.
- Every API error includes an `X-Request-ID` response header and the same request ID in the JSON error body.
- Do not expose Cortex or LLM API keys in frontend code.
- Do not place any secret in a `NEXT_PUBLIC_*` environment variable.

---

## 4. Required Frontend Workflow

```text
1. POST /v1/assessments
2. POST /v1/assessments/{id}/image-assessment
3. If retake_required:
      show retake guidance
      submit a replacement image using the same assessment ID
   Otherwise:
      show preliminary result
4. PUT /v1/assessments/{id}/questionnaire
5. Branch on safety.recommendation_permission
6. If allowed:
      POST /v1/assessments/{id}/recommendation
7. GET /v1/assessments/{id}
8. Render recommendation or safety feedback
```

The frontend must preserve this order.

Calling a later endpoint too early returns:

```text
409 ASSESSMENT_STATE_CONFLICT
```

---

## 5. Endpoint Summary

| Method | Path | Purpose | Success |
|---|---|---|---|
| `GET` | `/health` | Hosting and liveness check | `200` |
| `POST` | `/v1/assessments` | Create assessment workflow | `201` |
| `POST` | `/v1/assessments/{id}/image-assessment` | Upload and assess one image | `200` |
| `PUT` | `/v1/assessments/{id}/questionnaire` | Save answers and run deterministic safety | `200` |
| `POST` | `/v1/assessments/{id}/recommendation` | Generate educational guidance for allowed cases | `200` |
| `GET` | `/v1/assessments/{id}` | Load or resume normalized workflow state | `200` |
| `POST` | `/v1/referrals` | Submit a prototype referral request | `201` |

Do not use these deprecated endpoints:

```text
POST /v1/assessments/{id}/image
POST /v1/assessments/{id}/classify
```

They return:

```text
409 ASSESSMENT_STATE_CONFLICT
```

---

# 6. Endpoint Details

## 6.1 Health Check

```http
GET /health
```

Full URL:

```text
https://skinsense-backend-240757536793.us-central1.run.app/health
```

Response:

```json
{
  "status": "ok"
}
```

This confirms that the API process is running. It does not verify Cortex availability.

Frontend assessment pages do not need to call this before every workflow.

---

## 6.2 Create an Assessment

```http
POST /v1/assessments
Content-Type: application/json
```

Full URL:

```text
https://skinsense-backend-240757536793.us-central1.run.app/v1/assessments
```

Request:

```json
{}
```

Response:

```json
{
  "id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "status": "draft"
}
```

TypeScript:

```ts
export interface CreateAssessmentResponse {
  id: string;
  status: "draft";
}
```

Recommended frontend behavior:

1. Call this when the user starts an assessment.
2. Store only the returned assessment ID in `sessionStorage`.
3. Navigate to `/assessment/{id}`.
4. Never invent an assessment ID in the frontend.

Example:

```ts
const created = await createAssessment();

sessionStorage.setItem("assessment_id", created.id);
router.push(`/assessment/${created.id}`);
```

---

## 6.3 Assess an Image

```http
POST /v1/assessments/{assessment_id}/image-assessment
Content-Type: multipart/form-data
```

Multipart field:

| Field | Type | Required |
|---|---|---|
| `image` | File | Yes |

Browser request:

```ts
const formData = new FormData();
formData.append("image", file);

const response = await fetch(
  `${API_BASE_URL}/v1/assessments/${assessmentId}/image-assessment`,
  {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
    cache: "no-store",
  },
);
```

Do not manually set `Content-Type` for this request.

### Image requirements

- JPEG, PNG, or WebP;
- declared MIME must match decoded format;
- maximum upload size: 8 MiB;
- minimum width: 320 pixels;
- minimum height: 320 pixels;
- maximum decoded size: 20 million pixels;
- one image only.

### Successful response

```json
{
  "assessment_status": "completed",
  "condition": "acne",
  "confidence_level": "high",
  "confidence_score": 0.88,
  "visual_findings": [
    "visible_bumps",
    "pustules"
  ],
  "alternative_conditions": [
    "folliculitis"
  ],
  "image_quality": {
    "status": "acceptable",
    "issues": []
  },
  "needs_more_information": true,
  "follow_up_question_ids": [
    "duration",
    "pain_level",
    "possible_infection"
  ],
  "visual_safety_signals": [],
  "recommendation_status": "pending_questionnaire",
  "assessment_engine": "multimodal_llm_prototype",
  "engine_version": "cortex:gemini-2.5-flash",
  "prompt_version": "image-assessment-v1",
  "limitations": [
    "This is a preliminary AI-assisted assessment.",
    "This is not a confirmed diagnosis."
  ],
  "assessed_at": "2026-07-29T18:30:00Z",
  "inference_ms": 4100
}
```

### Retake response

```json
{
  "assessment_status": "retake_required",
  "condition": "other_or_uncertain",
  "confidence_level": "unknown",
  "confidence_score": null,
  "visual_findings": [],
  "alternative_conditions": [],
  "image_quality": {
    "status": "retake_required",
    "issues": [
      "blurred",
      "poor_lighting"
    ]
  },
  "needs_more_information": true,
  "follow_up_question_ids": [],
  "visual_safety_signals": [],
  "recommendation_status": "blocked",
  "assessment_engine": "multimodal_llm_prototype",
  "engine_version": "cortex:gemini-2.5-flash",
  "prompt_version": "image-assessment-v1",
  "limitations": [
    "This is a preliminary AI-assisted assessment.",
    "This is not a confirmed diagnosis."
  ],
  "assessed_at": "2026-07-29T18:30:00Z",
  "inference_ms": 2500
}
```

When `image_quality.status === "retake_required"`:

- show mapped guidance for each issue;
- do not show the questionnaire;
- do not call the recommendation endpoint;
- allow the user to submit a replacement image using the same assessment ID.

Submitting a replacement image clears any stored questionnaire, safety result, or recommendation for that assessment.

### Controlled conditions

```text
eczema
fungal_infection
scabies
impetigo
acne
psoriasis
folliculitis
other_or_uncertain
```

### Confidence levels

```text
low
moderate
high
unknown
```

### Image quality issues

```text
blurred
poor_lighting
too_far
obstructed
multiple_unrelated_areas
no_visible_skin_concern
```

### Visual findings

```text
dry_appearing_patch
visible_scaling
visible_bumps
color_change
crusting
pustules
plaque_like_area
non_specific_visible_change
```

### Visual safety signals

```text
possible_eye_involvement
possible_infection
possible_significant_bleeding
possible_open_wound
possible_extensive_blistering
unsupported_scope
```

---

## 6.4 Submit the Questionnaire

```http
PUT /v1/assessments/{assessment_id}/questionnaire
Content-Type: application/json
```

Every field is required.

Missing safety answers are rejected. Missing values are never interpreted as `no`.

Request:

```json
{
  "duration": "one_to_four_weeks",
  "itching": "yes",
  "pain_level": 2,
  "rapidly_spreading": "no",
  "affected_body_area": "face_or_neck",
  "fever": "no",
  "high_fever": "no",
  "swelling": "no",
  "difficulty_breathing": "no",
  "lip_tongue_throat_swelling": "no",
  "bleeding": "no",
  "blistering": "no",
  "open_wound": "no",
  "eye_involvement": "no",
  "possible_infection": "no",
  "previous_treatment": [],
  "known_allergies": [],
  "current_products": [],
  "age_group": "adult",
  "recurrent": "no"
}
```

### Yes/no fields

Safety-sensitive fields accept:

```text
yes
no
unsure
```

### Pain level

```text
0 through 10
```

### Duration values

```text
less_than_one_week
one_to_four_weeks
one_to_six_months
more_than_six_months
unsure
```

### Affected body area values

```text
face_or_neck
scalp
chest_or_back
arms_or_hands
legs_or_feet
groin_or_skin_folds
other
unsure
```

### Age group values

```text
infant
child
adolescent
adult
older_adult
prefer_not_to_say
```

### Text arrays

The following arrays accept:

- no more than 10 entries;
- non-empty strings;
- maximum 100 characters per entry;
- no duplicates, case-insensitively.

Fields:

```text
previous_treatment
known_allergies
current_products
```

### Routine response

```json
{
  "id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "status": "questionnaire_completed",
  "safety": {
    "urgency": "routine",
    "red_flags": [],
    "recommendation_permission": "allowed",
    "policy_version": "v1",
    "action_message": "No deterministic red flag was identified from the information provided. Continue to educational guidance and seek care if symptoms worsen.",
    "feedback": null
  }
}
```

Only this branch may call the recommendation endpoint.

### Urgent response

```json
{
  "id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "status": "urgent",
  "safety": {
    "urgency": "urgent",
    "red_flags": [
      "rapidly_spreading",
      "high_fever"
    ],
    "recommendation_permission": "escalation_only",
    "policy_version": "v1",
    "action_message": "Seek urgent in-person medical care as soon as possible. Do not rely on an AI assessment for these warning signs.",
    "feedback": {
      "heading": "Urgent warning signs were reported",
      "triggers": [
        {
          "code": "rapidly_spreading",
          "label": "The concern was reported as spreading quickly."
        },
        {
          "code": "high_fever",
          "label": "A high fever was reported."
        }
      ],
      "next_steps": [
        "Arrange urgent in-person medical care as soon as possible.",
        "Tell the healthcare professional which warning signs triggered this result.",
        "Seek emergency help if breathing difficulty or lip, tongue, or throat swelling develops."
      ],
      "guidance_withheld_reason": "Treatment-like guidance was withheld because urgent warning signs require in-person assessment before condition-specific advice.",
      "clinician_summary": {
        "preliminary_condition": "acne",
        "confidence_level": "high",
        "duration": "one_to_four_weeks",
        "affected_body_area": "face_or_neck",
        "age_group": "adult",
        "pain_level": 2,
        "reported_yes_answers": [
          "itching",
          "rapidly_spreading",
          "high_fever"
        ],
        "reported_unsure_answers": [],
        "previous_treatment": [],
        "known_allergies": [],
        "current_products": []
      }
    }
  }
}
```

### Status mapping

| Safety urgency | Response status | Recommendation permission |
|---|---|---|
| `routine` | `questionnaire_completed` | `allowed` |
| `professional_review` | `professional_review_required` | `blocked` |
| `urgent` | `urgent` | `escalation_only` |
| `emergency` | `emergency` | `escalation_only` |

---

## 6.5 Generate a Recommendation

```http
POST /v1/assessments/{assessment_id}/recommendation
Content-Type: application/json
```

Request:

```json
{}
```

Call this endpoint only when:

```json
{
  "safety": {
    "recommendation_permission": "allowed"
  }
}
```

The frontend must not send:

- image data;
- assessment result;
- questionnaire;
- safety result;
- condition;
- confidence;
- provider response.

The backend retrieves its own normalized state using the assessment ID.

Response:

```json
{
  "assessment_id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "condition": "acne",
  "confidence_level": "high",
  "confidence_score": 0.88,
  "guidance_level": "condition_specific_guidance",
  "referral_required": false,
  "safety": {
    "urgency": "routine",
    "red_flags": [],
    "recommendation_permission": "allowed",
    "policy_version": "v1",
    "action_message": "No deterministic red flag was identified from the information provided. Continue to educational guidance and seek care if symptoms worsen.",
    "feedback": null
  },
  "model_version": "cortex:gemini-2.5-flash",
  "prompt_version": "v1",
  "disclaimer": "This output is educational and not a medical diagnosis. If symptoms are severe, worsening, or concerning, seek qualified professional care promptly.",
  "generated_at": "2026-07-29T18:31:00Z",
  "draft": {
    "explanation": "Educational explanation generated from structured context.",
    "possible_contributing_factors": [
      "Example factor"
    ],
    "skin_tone_considerations": [
      "Example consideration"
    ],
    "recommended_action": {
      "type": "condition_specific_guidance",
      "urgency": "routine",
      "steps": [
        "Example educational next step"
      ],
      "referral_reason": null
    },
    "prevention": [
      "Example prevention item"
    ],
    "warning_signs": [
      "Rapid worsening"
    ],
    "limitations": [
      "This is not a diagnosis."
    ]
  }
}
```

### Guidance levels

```text
urgent_referral
professional_review
retake_or_review
cautious_guidance
condition_specific_guidance
```

The guarded workflow normally reaches this endpoint only for:

```text
cautious_guidance
condition_specific_guidance
```

### Idempotency

After an assessment reaches `completed`, repeating the recommendation request returns the stored recommendation instead of calling the provider again.

### Blocked calls

If the frontend incorrectly calls this endpoint for a blocked assessment, the backend returns:

```text
409 RECOMMENDATION_BLOCKED
```

For urgent or emergency states:

```text
409 RED_FLAG_ESCALATION_REQUIRED
```

Do not use those errors as the normal branch. Branch on the questionnaire response first.

---

## 6.6 Load an Assessment

```http
GET /v1/assessments/{assessment_id}
```

Use this endpoint to:

- resume a workflow;
- render the result page;
- recover after navigation;
- confirm recommendation generation;
- display deterministic safety feedback.

TypeScript:

```ts
export interface AssessmentDetail {
  id: string;
  status: AssessmentStatus;
  assessment: ImageAssessmentResult | null;
  questionnaire: Questionnaire | null;
  safety: SafetyResult | null;
  skin_context: SkinContext;
  recommendation: RecommendationResult | null;
}
```

Fields remain nullable until their workflow stage has completed.

### Backend statuses

```ts
export type AssessmentStatus =
  | "draft"
  | "assessment_completed"
  | "retake_required"
  | "questionnaire_completed"
  | "completed"
  | "professional_review_required"
  | "urgent"
  | "emergency";
```

### Recommended route behavior

| Backend status | Frontend state |
|---|---|
| `draft` | Image selection |
| `assessment_completed` | Preliminary result and questionnaire |
| `retake_required` | Retake guidance |
| `questionnaire_completed` | Generate or load recommendation |
| `completed` | Recommendation result |
| `professional_review_required` | Professional-review safety result |
| `urgent` | Urgent safety result |
| `emergency` | Emergency safety result |

### Cloud Run state limitation

The backend currently stores state in process memory.

A Cloud Run restart, redeployment, scale-out event, or request routed to another instance can make an older ID unavailable.

The frontend must handle:

```text
404 ASSESSMENT_NOT_FOUND
```

Recommended response:

1. clear the saved assessment ID;
2. explain that the session expired;
3. offer to begin a new assessment;
4. do not enter an infinite reload loop.

---

## 6.7 Submit a Referral Request

```http
POST /v1/referrals
Content-Type: application/json
```

Request:

```json
{
  "assessment_id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "name": "Example User",
  "contact": "user@example.com",
  "reason": "I would like a professional review."
}
```

Response:

```json
{
  "id": "0a9fd389-b9cc-419d-b39e-edbf51730d99",
  "status": "received"
}
```

Current limitations:

- the backend does not verify that the assessment ID exists;
- requests are stored only in process memory;
- no clinician or care team is notified;
- no authentication or ownership check exists;
- extra request properties are ignored.

The frontend must not claim that a clinician received the request.

Authoritative frontend type:

```ts
export interface ReferralRequest {
  assessment_id: string;
  name: string;
  contact: string;
  reason: string;
}
```

---

# 7. Safety Branching

The questionnaire response is the frontend safety decision point.

```ts
const questionnaireResult = await saveQuestionnaire(
  assessmentId,
  questionnaire,
);

const { safety } = questionnaireResult;

if (safety.recommendation_permission === "allowed") {
  await getAssessmentRecommendation(assessmentId);
}

router.push(`/result/${assessmentId}`);
```

Result rendering:

```ts
const record = await getAssessment(assessmentId);

if (
  record.safety &&
  record.safety.recommendation_permission !== "allowed"
) {
  renderSafetyFeedback(record.safety);
} else if (record.recommendation) {
  renderRecommendation(record.recommendation);
} else {
  renderNotReady();
}
```

## Non-routine display order

For professional review, urgent, and emergency outcomes:

1. show urgency and `safety.action_message`;
2. show `safety.feedback.heading`;
3. show all backend-provided trigger labels;
4. show all backend-provided next steps;
5. show the preliminary condition and confidence as non-diagnostic;
6. show or copy the clinician summary;
7. show `guidance_withheld_reason`;
8. do not render treatment or self-care recommendation sections.

The frontend must not derive new medical instructions from `red_flags`.

## Safety visual priority

| Urgency | UI priority |
|---|---|
| `emergency` | Highest-emphasis emergency screen |
| `urgent` | High-emphasis urgent screen |
| `professional_review` | Review-required screen |
| `routine` | Continue to educational recommendation |

---

# 8. Error Contract

Every non-success response uses:

```json
{
  "error": {
    "code": "IMAGE_DECODE_FAILED",
    "message": "The uploaded image could not be decoded.",
    "retryable": false,
    "details": {},
    "request_id": "opaque-request-id"
  }
}
```

TypeScript:

```ts
export interface BackendErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details: unknown;
    request_id: string;
  };
}
```

## Error reference

| HTTP | Code | Frontend behavior |
|---|---|---|
| `404` | `ASSESSMENT_NOT_FOUND` | Clear stale ID and start again |
| `409` | `ASSESSMENT_STATE_CONFLICT` | Reload assessment and route to required step |
| `409` | `RECOMMENDATION_BLOCKED` | Load and display safety feedback |
| `409` | `RED_FLAG_ESCALATION_REQUIRED` | Load urgent or emergency feedback |
| `413` | `IMAGE_TOO_LARGE` | Request an image under 8 MiB |
| `415` | `INVALID_IMAGE_TYPE` | Request a genuine JPEG, PNG, or WebP |
| `422` | `IMAGE_DECODE_FAILED` | Request another readable image |
| `422` | `IMAGE_QUALITY_INSUFFICIENT` | Show retake guidance |
| `422` | `VALIDATION_ERROR` | Mark invalid fields |
| `502` | `ASSESSMENT_OUTPUT_INVALID` | Offer a safe retry or new image |
| `503` | `ASSESSMENT_PROVIDER_UNAVAILABLE` | Show temporary outage |
| `503` | `RECOMMENDATION_UNAVAILABLE` | Keep assessment and allow recommendation retry |
| `504` | `ASSESSMENT_TIMEOUT` | Offer upload or assessment retry |
| `500` | `INTERNAL_ERROR` | Show generic failure and request ID |

Network failures generated by the frontend client should use:

```ts
{
  status: 0,
  code: "NETWORK_ERROR",
  retryable: true
}
```

## Validation errors

A validation error may include:

```json
{
  "fields": [
    {
      "path": "body.pain_level",
      "message": "Input should be less than or equal to 10",
      "type": "less_than_equal"
    }
  ]
}
```

Server messages may be displayed as plain text.

Never render backend error messages as HTML.

---

# 9. Retry and Timeout Guidance

| Request | Retry guidance |
|---|---|
| `GET /health` | Safe to retry |
| `POST /v1/assessments` | Do not blindly retry after unknown response |
| Image assessment | Prefer user-controlled retry |
| Questionnaire `PUT` | Safe to resend while state permits |
| Recommendation `POST` | Safe for routine state; completed calls are idempotent |
| Assessment `GET` | Safe to retry |
| Referral `POST` | Do not blindly retry; duplicates are possible |

Recommended limits:

- one automatic retry for transient `GET` failures;
- user-confirmed retry for image assessment;
- user-confirmed retry for recommendation;
- no automatic retry for blocked safety paths;
- never retry indefinitely.

Optional browser timeout:

```ts
const controller = new AbortController();

const timeout = window.setTimeout(
  () => controller.abort(),
  120_000,
);

try {
  return await fetch(url, {
    ...init,
    signal: controller.signal,
  });
} finally {
  window.clearTimeout(timeout);
}
```

Do not use a browser timeout shorter than the backend provider deadline.

---

# 10. Image Handling

## Client-side validation

```ts
const acceptedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const maximumBytes = 8 * 1024 * 1024;
```

Client validation improves usability but is not a security boundary.

## Preview

```ts
const previewUrl = URL.createObjectURL(file);
```

Revoke it when the image is replaced or the component unmounts:

```ts
URL.revokeObjectURL(previewUrl);
```

## Capture guidance

Tell users to:

- use bright, even lighting;
- keep the affected area centered;
- move close enough for detail;
- avoid filters and beauty modes;
- avoid shadows;
- include one skin concern per image;
- avoid unrelated areas;
- avoid screenshots from other applications.

## Never

- convert the image to Base64 in the browser;
- store image data in localStorage or sessionStorage;
- send image data to the recommendation endpoint;
- send multiple image fields;
- trust only the filename extension;
- log image data to analytics.

The backend validates, sanitizes, sends the sanitized image to Cortex, and discards image bytes after processing.

---

# 11. Frontend State Management

## Store

- assessment ID in `sessionStorage`;
- transient reducer or state-machine state;
- local object URL for image preview.

## Do not store

- raw image bytes;
- Base64 image data;
- Cortex responses;
- API secrets;
- questionnaire data in localStorage;
- referral contacts in analytics;
- complete medical results in browser logs.

## Resume pattern

```ts
const record = await getAssessment(assessmentId);

switch (record.status) {
  case "draft":
    showUpload();
    break;

  case "assessment_completed":
    showQuestionnaire();
    break;

  case "retake_required":
    showRetake();
    break;

  case "questionnaire_completed":
    generateOrLoadRecommendation();
    break;

  case "completed":
    showRecommendation();
    break;

  case "professional_review_required":
  case "urgent":
  case "emergency":
    showSafetyFeedback(record.safety);
    break;
}
```

---

# 12. Recommended Frontend Structure

```text
frontend/src/
├── app/
│   ├── page.tsx
│   ├── assessment/[id]/page.tsx
│   └── result/[id]/page.tsx
├── components/
│   ├── ImageUploader.tsx
│   ├── PreliminaryAssessment.tsx
│   ├── RetakeGuidance.tsx
│   ├── QuestionnaireStep.tsx
│   ├── SafetyFeedback.tsx
│   ├── RecommendationResult.tsx
│   └── ApiErrorPanel.tsx
├── features/assessment/
│   ├── api.ts
│   ├── types.ts
│   ├── state-machine.ts
│   ├── validation.ts
│   └── display-mappers.ts
└── lib/
    └── api-client.ts
```

Recommended responsibilities:

- `api.ts`: endpoint calls;
- `types.ts`: API-facing types;
- `state-machine.ts`: valid UI transitions;
- `validation.ts`: browser-side image and form validation;
- `display-mappers.ts`: controlled code-to-label mappings;
- `SafetyFeedback.tsx`: renders backend-owned safety guidance;
- `RecommendationResult.tsx`: routine educational guidance only;
- `ApiErrorPanel.tsx`: stable error handling and request ID display.

---

# 13. Minimal TypeScript API Client

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://skinsense-backend-240757536793.us-central1.run.app";

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return new URL(normalizedPath, API_BASE_URL).toString();
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly details: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError(
      "Unable to reach the server.",
      0,
      "NETWORK_ERROR",
      true,
      {},
    );
  }

  if (!response.ok) {
    const payload = await response.json();
    const error = payload.error;

    throw new ApiClientError(
      error.message,
      response.status,
      error.code,
      error.retryable,
      error.details,
      error.request_id,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

High-level API functions:

```ts
export async function createAssessment(): Promise<CreateAssessmentResponse>;

export async function assessImage(
  assessmentId: string,
  image: File,
): Promise<ImageAssessmentResult>;

export async function saveQuestionnaire(
  assessmentId: string,
  questionnaire: Questionnaire,
): Promise<QuestionnaireResponse>;

export async function getAssessmentRecommendation(
  assessmentId: string,
): Promise<RecommendationResult>;

export async function getAssessment(
  assessmentId: string,
): Promise<AssessmentDetail>;

export async function requestReferral(
  request: ReferralRequest,
): Promise<ReferralResponse>;
```

---

# 14. Security and Privacy Rules

Frontend implementations must:

- describe results as preliminary and non-diagnostic;
- never suppress urgent or emergency messages;
- never call recommendation generation for blocked safety paths;
- never derive treatment instructions from a condition label;
- never expose `CORTEX_API_KEY` or other server secrets;
- never place provider keys in `NEXT_PUBLIC_*`;
- never display raw Cortex responses;
- never log images, questionnaires, contact details, or complete API responses by default;
- avoid sending assessment data to third-party trackers;
- clear stale assessment IDs after `ASSESSMENT_NOT_FOUND`;
- treat referral contact details as sensitive;
- use HTTPS for all production calls.

---

# 15. Cloud Run Limitations

The backend is currently:

```text
unauthenticated
in-memory
process-local
```

Consequences:

- assessment state may disappear after a restart;
- deployments clear state;
- scale-out can route later requests to another instance;
- referral requests are not persistent;
- old assessment IDs may return `404 ASSESSMENT_NOT_FOUND`.

Frontend requirements:

- handle lost state gracefully;
- clear stale session IDs;
- let the user restart;
- do not promise saved assessments;
- do not claim persistence;
- do not claim clinician notification.

For a controlled demo, the backend may be configured with one maximum instance, but this does not guarantee persistence.

---

# 16. QA Scenarios

| Scenario | Expected behavior |
|---|---|
| Valid routine image | Assessment → questionnaire → recommendation |
| Blurred image | Retake guidance; no questionnaire |
| Poor lighting | Retake guidance |
| Unsupported image | File-type error |
| Oversized image | Size error |
| Low confidence | Professional review; no recommendation |
| Unknown condition | Professional review |
| Rapid spread | Urgent safety path |
| High fever | Urgent safety path |
| Breathing difficulty | Emergency safety path |
| Provider timeout | Retry option and request ID |
| Cortex unavailable | Temporary outage message |
| Stale assessment ID | Clear session and restart |
| Repeated recommendation request | Stored recommendation returned |
| Blocked recommendation call | Load safety feedback |
| Cloud Run restart | Graceful assessment-expired flow |

---

# 17. Frontend Acceptance Checklist

- [ ] `NEXT_PUBLIC_API_BASE_URL` points to the Cloud Run backend.
- [ ] The frontend origin is added to backend CORS.
- [ ] An assessment is created before image upload.
- [ ] Image upload uses `FormData`.
- [ ] The field name is exactly `image`.
- [ ] Multipart `Content-Type` is not set manually.
- [ ] Only JPEG, PNG, and WebP are accepted by the browser UI.
- [ ] Images larger than 8 MiB are rejected before upload.
- [ ] Object URLs are revoked.
- [ ] Retake-required flows do not proceed to the questionnaire.
- [ ] Every questionnaire field has an explicit value.
- [ ] Recommendation is called only when permission is `allowed`.
- [ ] Blocked paths render backend `SafetyFeedback`.
- [ ] Urgent and emergency messages appear before the condition.
- [ ] Result pages reload using `GET /v1/assessments/{id}`.
- [ ] Error codes drive user-friendly messages.
- [ ] Request IDs are retained for support.
- [ ] Only the assessment ID is stored in session storage.
- [ ] No image bytes or Base64 are persisted.
- [ ] No server secret appears in frontend code.
- [ ] No medical or contact data is sent to analytics.
- [ ] Referral UI does not claim clinician delivery.
- [ ] `ASSESSMENT_NOT_FOUND` clears stale state.
- [ ] Production CORS is configured before launch.

---

# 18. Deprecated Endpoints

Do not use:

```text
POST /v1/assessments/{id}/image
POST /v1/assessments/{id}/classify
```

Use:

```text
POST /v1/assessments/{id}/image-assessment
```

---

# 19. Final Handoff Notes

- The backend is deployed on Google Cloud Run.
- The Swagger documentation is available at:

```text
https://skinsense-backend-240757536793.us-central1.run.app/docs
```

- Cortex is called by the backend, not the frontend.
- The frontend should never know or care which multimodal provider is active.
- The backend owns:
  - image validation;
  - provider invocation;
  - condition normalization;
  - safety rules;
  - recommendation permission;
  - escalation guidance;
  - final error contracts.
- The frontend owns:
  - capture experience;
  - workflow presentation;
  - state restoration;
  - accessibility;
  - safe rendering;
  - user-friendly error recovery.

The most important frontend responsibility is preserving safety-first branching and non-diagnostic wording.
