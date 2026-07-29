# Frontend API Integration Contract

This document is the implementation guide for any SkinSense Africa web or
mobile frontend consuming the guarded assessment backend.

It documents the current backend contract implemented in
`backend/app/api/routers/assessments.py`. The generated OpenAPI document remains
the machine-readable authority, while this guide explains the required
frontend sequence and safety behavior.

## Contents

- [Base URL and transport](#base-url-and-transport)
- [Required frontend sequence](#required-frontend-sequence)
- [Endpoint summary](#endpoint-summary)
- [1. Health check](#1-health-check)
- [2. Create an assessment](#2-create-an-assessment)
- [3. Assess an image](#3-assess-an-image)
- [4. Submit the questionnaire](#4-submit-the-questionnaire)
- [5. Generate a recommendation](#5-generate-a-recommendation)
- [6. Load an assessment](#6-load-an-assessment)
- [7. Submit a referral request](#7-submit-a-referral-request)
- [Safety branching](#safety-branching)
- [Error contract](#error-contract)
- [Frontend state mapping](#frontend-state-mapping)
- [TypeScript client pattern](#typescript-client-pattern)
- [Retry and timeout guidance](#retry-and-timeout-guidance)
- [Image handling requirements](#image-handling-requirements)
- [Security and privacy rules](#security-and-privacy-rules)
- [Integration checklist](#integration-checklist)

## Base URL and transport

All endpoint paths in this document are relative to:

```text
API_BASE_URL
```

For a direct hosted backend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://your-backend-service.example
```

For local development through the existing Next.js rewrite:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api
```

`NEXT_PUBLIC_API_BASE_URL` may also be omitted because `/api` is the frontend
default. The rewrite in `frontend/next.config.mjs` forwards `/api/*` to
`http://127.0.0.1:8000/*`.

The existing frontend normalizes trailing slashes from the base URL.

### Request conventions

- Use HTTPS outside local development.
- Send `Accept: application/json`.
- Send `Content-Type: application/json` for JSON requests.
- Do **not** manually set `Content-Type` for `FormData`; the browser must add the
  multipart boundary.
- Do not cache assessment requests or responses.
- The backend currently has no user authentication.
- Every API error includes an `X-Request-ID` response header and the same
  request ID in the JSON error body.

### CORS

The current backend allows these development origins:

```text
http://localhost:3000
http://127.0.0.1:3000
```

A future hosted frontend origin must be added to the backend CORS allow-list
before deployment.

## Required frontend sequence

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as SkinSense API
    participant Assess as Image provider
    participant Safety as Deterministic safety
    participant Recommend as Recommendation provider

    UI->>API: POST /v1/assessments
    API-->>UI: 201 { id, status: "draft" }

    UI->>API: POST /v1/assessments/{id}/image-assessment
    API->>Assess: Sanitized image assessment
    Assess-->>API: Strict preliminary result
    API-->>UI: ImageAssessmentResult

    alt retake_required
        UI->>UI: Show retake reasons
        UI->>API: POST replacement image using same id
    else completed
        UI->>UI: Show preliminary result and questionnaire
        UI->>API: PUT /v1/assessments/{id}/questionnaire
        API->>Safety: Evaluate backend rules
        Safety-->>API: SafetyResult
        API-->>UI: { id, status, safety }

        alt recommendation_permission = allowed
            UI->>API: POST /v1/assessments/{id}/recommendation
            API->>Recommend: Image-free structured invocation
            Recommend-->>API: Recommendation draft
            API-->>UI: RecommendationResult
        else blocked or escalation_only
            UI->>API: GET /v1/assessments/{id}
            API-->>UI: Assessment with SafetyFeedback
            UI->>UI: Render safety result; do not request recommendation
        end
    end
```

The frontend must preserve this order. Calling a later endpoint too early
returns `409 ASSESSMENT_STATE_CONFLICT`.

## Endpoint summary

| Method | Path | Frontend use | Success |
|---|---|---|---|
| `GET` | `/health` | Hosting/liveness check | `200` |
| `POST` | `/v1/assessments` | Create a workflow ID | `201` |
| `POST` | `/v1/assessments/{id}/image-assessment` | Upload and assess one image | `200` |
| `PUT` | `/v1/assessments/{id}/questionnaire` | Save answers and run safety | `200` |
| `POST` | `/v1/assessments/{id}/recommendation` | Generate allowed educational guidance | `200` |
| `GET` | `/v1/assessments/{id}` | Resume/load normalized workflow state | `200` |
| `POST` | `/v1/referrals` | Submit a prototype contact request | `201` |

Do not use these deprecated endpoints:

```text
POST /v1/assessments/{id}/image
POST /v1/assessments/{id}/classify
```

They return `409 ASSESSMENT_STATE_CONFLICT`.

## 1. Health check

```http
GET /health
```

Response: `200 OK`

```json
{
  "status": "ok"
}
```

This endpoint verifies that the API process can respond. It does not call
Cortex and does not prove provider availability.

Frontend assessment screens do not need to call it before every workflow.
Use it for hosting monitoring or an optional connection diagnostic.

## 2. Create an assessment

```http
POST /v1/assessments
Content-Type: application/json
```

Request:

```json
{}
```

Response: `201 Created`

```json
{
  "id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "status": "draft"
}
```

TypeScript:

```ts
interface CreateAssessmentResponse {
  id: string;
  status: 'draft';
}
```

Frontend behavior:

1. Call this before displaying the upload workflow or when the user starts
   over.
2. Store only the returned assessment ID in session storage.
3. Navigate to `/assessment/{id}`.
4. Do not invent an ID in the frontend.

Current implementation:

```ts
const created = await createAssessment();
sessionStorage.setItem('assessment_id', created.id);
router.push(`/assessment/${created.id}`);
```

## 3. Assess an image

```http
POST /v1/assessments/{assessment_id}/image-assessment
Content-Type: multipart/form-data
```

Multipart field:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `image` | File | Yes | One JPEG, PNG, or WebP image |

Browser request:

```ts
const formData = new FormData();
formData.append('image', file);

const response = await fetch(
  `${API_BASE_URL}/v1/assessments/${assessmentId}/image-assessment`,
  {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
    cache: 'no-store',
  },
);
```

Do not add a `Content-Type` header to this request.

### Image requirements

- Actual format: JPEG, PNG, or WebP
- Declared MIME must match decoded format
- Maximum encoded upload: 8 MiB by default
- Minimum width: 320 pixels
- Minimum height: 320 pixels
- Maximum decoded size: 20 million pixels
- One image only

### Successful assessment response

Response: `200 OK`

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

A technically successful request can still require a new image:

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

If `image_quality.status === "retake_required"`:

- show mapped guidance for every issue;
- do not show the questionnaire;
- do not call the recommendation endpoint;
- let the user submit a replacement image with the same assessment ID.

Submitting a replacement image clears any questionnaire, safety, or
recommendation previously stored for that assessment.

### Controlled values

`condition`:

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

`confidence_level`:

```text
low
moderate
high
unknown
```

`image_quality.issues`:

```text
blurred
poor_lighting
too_far
obstructed
multiple_unrelated_areas
no_visible_skin_concern
```

`visual_findings`:

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

`visual_safety_signals`:

```text
possible_eye_involvement
possible_infection
possible_significant_bleeding
possible_open_wound
possible_extensive_blistering
unsupported_scope
```

## 4. Submit the questionnaire

```http
PUT /v1/assessments/{assessment_id}/questionnaire
Content-Type: application/json
```

Every field is required. Missing safety answers are rejected; absence is never
interpreted as `no`.

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

### Questionnaire value rules

Every yes/no safety field accepts:

```text
yes
no
unsure
```

`pain_level` is an integer from 0 through 10.

`duration`:

```text
less_than_one_week
one_to_four_weeks
one_to_six_months
more_than_six_months
unsure
```

`affected_body_area`:

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

`age_group`:

```text
infant
child
adolescent
adult
older_adult
prefer_not_to_say
```

The three text arrays:

- accept no more than 10 entries each;
- accept non-empty strings of at most 100 characters;
- reject duplicate entries case-insensitively.

### Routine response

Response: `200 OK`

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

Professional-review, urgent, and emergency results always include
`safety.feedback`. Routine results always use `feedback: null`.

### Questionnaire response status

| Safety urgency | Response `status` | Permission |
|---|---|---|
| `routine` | `questionnaire_completed` | `allowed` |
| `professional_review` | `professional_review_required` | `blocked` |
| `urgent` | `urgent` | `escalation_only` |
| `emergency` | `emergency` | `escalation_only` |

## 5. Generate a recommendation

```http
POST /v1/assessments/{assessment_id}/recommendation
Content-Type: application/json
```

Request:

```json
{}
```

Call this endpoint only when the questionnaire response contains:

```json
{
  "safety": {
    "recommendation_permission": "allowed"
  }
}
```

The frontend does not send the assessment result, questionnaire, safety result,
or image back to this endpoint. The backend retrieves its own normalized state
using the assessment ID.

Response: `200 OK`

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

`guidance_level` values:

```text
urgent_referral
professional_review
retake_or_review
cautious_guidance
condition_specific_guidance
```

The current guarded workflow normally reaches this endpoint only for
`cautious_guidance` or `condition_specific_guidance`.

### Idempotency

Once an assessment reaches `completed`, repeating this request returns the
stored recommendation instead of calling the provider again.

### Blocked calls

If the frontend incorrectly calls this endpoint for a non-routine safety
result, the backend returns:

- `409 RECOMMENDATION_BLOCKED` for professional review;
- `409 RED_FLAG_ESCALATION_REQUIRED` for urgent or emergency.

Do not use that error as the normal branching mechanism. Branch on the
questionnaire response before making the request.

## 6. Load an assessment

```http
GET /v1/assessments/{assessment_id}
```

Response: `200 OK`

```json
{
  "id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "status": "completed",
  "assessment": {
    "assessment_status": "completed",
    "condition": "acne",
    "confidence_level": "high",
    "confidence_score": 0.88,
    "visual_findings": [
      "visible_bumps"
    ],
    "alternative_conditions": [],
    "image_quality": {
      "status": "acceptable",
      "issues": []
    },
    "needs_more_information": true,
    "follow_up_question_ids": [
      "duration"
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
  },
  "questionnaire": {
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
  },
  "safety": {
    "urgency": "routine",
    "red_flags": [],
    "recommendation_permission": "allowed",
    "policy_version": "v1",
    "action_message": "No deterministic red flag was identified from the information provided. Continue to educational guidance and seek care if symptoms worsen.",
    "feedback": null
  },
  "skin_context": {
    "tone_group": "unspecified"
  },
  "recommendation": {
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
    "disclaimer": "Educational guidance only.",
    "generated_at": "2026-07-29T18:31:00Z",
    "draft": {
      "explanation": "Educational explanation.",
      "possible_contributing_factors": [],
      "skin_tone_considerations": [],
      "recommended_action": {
        "type": "condition_specific_guidance",
        "urgency": "routine",
        "steps": [],
        "referral_reason": null
      },
      "prevention": [],
      "warning_signs": [],
      "limitations": []
    }
  }
}
```

Fields are nullable until their workflow stage has completed:

```ts
interface AssessmentDetail {
  id: string;
  status: AssessmentStatus;
  assessment: ImageAssessmentResult | null;
  questionnaire: Questionnaire | null;
  safety: SafetyResult | null;
  skin_context: SkinContext;
  recommendation: RecommendationResult | null;
}
```

The current frontend type does not expose `skin_context`, but the backend
returns it. Consumers may safely add it to the TypeScript interface.

Recommended uses:

- load the result page;
- resume from an ID stored in session storage;
- confirm that recommendation generation completed;
- display deterministic safety feedback for blocked paths.

If the backend restarted or replaced an in-memory instance, an old ID returns
`404 ASSESSMENT_NOT_FOUND`. Clear the saved ID and start a new assessment.

## 7. Submit a referral request

```http
POST /v1/referrals
Content-Type: application/json
```

Authoritative request:

```json
{
  "assessment_id": "4f051a93-2afa-45cd-9ab7-40177a5c31e6",
  "name": "Example User",
  "contact": "user@example.com",
  "reason": "I would like a professional review."
}
```

Response: `201 Created`

```json
{
  "id": "0a9fd389-b9cc-419d-b39e-edbf51730d99",
  "status": "received"
}
```

Important current behavior:

- the backend does not verify that `assessment_id` exists;
- the backend stores the request only in process memory;
- there is no notification or care-team integration;
- no authentication or ownership check exists;
- the backend request model ignores extra properties.

The current frontend sends an additional `summary` object. The backend silently
ignores it:

```json
{
  "summary": {
    "condition": "acne",
    "guidance_level": "condition_specific_guidance",
    "referral_required": false
  }
}
```

Frontend code must not assume this summary was stored or transmitted onward.
Until the backend contract is expanded, the authoritative frontend request type
should contain only:

```ts
interface ReferralRequest {
  assessment_id: string;
  name: string;
  contact: string;
  reason: string;
}
```

## Safety branching

The questionnaire response is the frontend's safety decision point.

```ts
const questionnaireResult = await saveQuestionnaire(
  assessmentId,
  questionnaire,
);

const { safety } = questionnaireResult;

if (safety.recommendation_permission === 'allowed') {
  await getAssessmentRecommendation(assessmentId);
  router.push(`/result/${assessmentId}`);
} else {
  // Do not call the recommendation endpoint.
  router.push(`/result/${assessmentId}`);
}
```

Result rendering:

```ts
const record = await getAssessment(assessmentId);

if (
  record.safety &&
  record.safety.recommendation_permission !== 'allowed'
) {
  renderSafetyFeedback(record.safety);
} else if (record.recommendation) {
  renderRecommendation(record.recommendation);
} else {
  renderNotReady();
}
```

### Non-routine display order

For `professional_review`, `urgent`, and `emergency`:

1. show `safety.action_message` and urgency first;
2. show `safety.feedback.heading`;
3. show every backend-provided trigger label;
4. show every backend-provided next step;
5. show the preliminary condition and confidence as non-diagnostic;
6. show or copy `clinician_summary`;
7. show `guidance_withheld_reason`;
8. do not render recommendation treatment/care sections.

Do not derive new medical instructions from `red_flags` in the browser. Display
the backend-owned labels and actions.

### Urgency presentation

| Urgency | Suggested UI priority |
|---|---|
| `emergency` | Highest-emphasis emergency banner |
| `urgent` | High-emphasis urgent banner |
| `professional_review` | Review-required banner |
| `routine` | Continue to recommendation flow |

## Error contract

Every non-success API response uses:

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
interface BackendErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details: unknown;
    request_id: string;
  };
}
```

### Error reference

| HTTP | Code | Typical frontend response |
|---|---|---|
| `404` | `ASSESSMENT_NOT_FOUND` | Clear stale ID and offer start-over |
| `409` | `ASSESSMENT_STATE_CONFLICT` | Reload state or return to required step |
| `409` | `RECOMMENDATION_BLOCKED` | Load and display safety feedback |
| `409` | `RED_FLAG_ESCALATION_REQUIRED` | Load and display urgent/emergency feedback |
| `413` | `IMAGE_TOO_LARGE` | Ask for an image under 8 MiB |
| `415` | `INVALID_IMAGE_TYPE` | Ask for genuine JPEG, PNG, or WebP |
| `422` | `IMAGE_DECODE_FAILED` | Ask for another readable image |
| `422` | `IMAGE_QUALITY_INSUFFICIENT` | Ask for a larger/closer image |
| `422` | `VALIDATION_ERROR` | Mark invalid form fields from `details.fields` |
| `502` | `ASSESSMENT_OUTPUT_INVALID` | Offer a safe retry/new image |
| `503` | `ASSESSMENT_PROVIDER_UNAVAILABLE` | Show temporary outage and retry option |
| `503` | `RECOMMENDATION_UNAVAILABLE` | Keep assessment and offer recommendation retry |
| `504` | `ASSESSMENT_TIMEOUT` | Offer upload/assessment retry |
| `500` | `INTERNAL_ERROR` | Show generic failure and retain request ID |

Network failures generated by the frontend client use:

```ts
{
  status: 0,
  code: 'NETWORK_ERROR',
  retryable: true
}
```

### Validation details

For a `VALIDATION_ERROR`, `details` has:

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

Treat server messages as user-displayable but never render them as HTML.

## Frontend state mapping

Backend record statuses:

```ts
type AssessmentStatus =
  | 'draft'
  | 'assessment_completed'
  | 'retake_required'
  | 'questionnaire_completed'
  | 'completed'
  | 'professional_review_required'
  | 'urgent'
  | 'emergency';
```

Recommended route behavior:

| Backend status | Frontend destination/state |
|---|---|
| `draft` | Image selection |
| `assessment_completed` | Preliminary result/questionnaire |
| `retake_required` | Retake guidance |
| `questionnaire_completed` | Generate or await recommendation |
| `completed` | Recommendation result |
| `professional_review_required` | Safety feedback result |
| `urgent` | Urgent safety feedback result |
| `emergency` | Emergency safety feedback result |

Store:

- assessment ID;
- transient reducer state;
- local image preview object URL while needed.

Do not store:

- image bytes in session/local storage;
- Base64 image data;
- provider credentials;
- raw provider responses;
- questionnaire or result data longer than necessary.

## TypeScript client pattern

The current implementation is in:

```text
frontend/src/features/assessment/api.ts
frontend/src/lib/api-client.ts
frontend/src/features/assessment/types.ts
```

Recommended high-level API:

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

URL construction:

```ts
function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL.startsWith('/')) {
    return `${API_BASE_URL}${normalizedPath}`;
  }

  return new URL(normalizedPath, API_BASE_URL).toString();
}
```

Error conversion:

```ts
if (!response.ok) {
  const payload = (await response.json()) as BackendErrorResponse;

  throw new ApiClientError(payload.error.message, {
    status: response.status,
    code: payload.error.code,
    retryable: payload.error.retryable,
    details: payload.error.details,
  });
}
```

## Retry and timeout guidance

### Safe automatic/manual retries

| Request | Retry guidance |
|---|---|
| `GET /health` | Safe to retry |
| `POST /v1/assessments` | Do not blindly retry after an unknown response; it may create another ID |
| Image assessment | User-controlled retry is preferred |
| Questionnaire `PUT` | Safe to resend with the same answers while state permits |
| Recommendation `POST` | Safe after routine state; completed calls are idempotent |
| Assessment `GET` | Safe to retry |
| Referral `POST` | Do not blindly retry after an unknown response; duplicates are possible |

Honor `error.retryable`, but do not retry indefinitely.

Suggested maximum UI behavior:

- one automatic retry for transient `GET` requests;
- user-confirmed retry for image assessment and recommendation;
- exponential backoff for background polling;
- never retry safety-blocked recommendation calls.

### Browser request timeouts

The current frontend client does not set a browser timeout. A future client can
use `AbortController`:

```ts
const controller = new AbortController();
const timeout = window.setTimeout(() => controller.abort(), 120_000);

try {
  return await fetch(url, {
    ...init,
    signal: controller.signal,
  });
} finally {
  window.clearTimeout(timeout);
}
```

Allow enough time for the backend's bounded provider calls. Do not use a
frontend timeout shorter than the configured backend deadline.

## Image handling requirements

Frontend validation provides early usability feedback but is not a security
boundary.

Before upload:

```ts
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maximumBytes = 8 * 1024 * 1024;
```

Preview:

```ts
const previewUrl = URL.createObjectURL(file);
```

Release the object URL when the image is replaced or the component unmounts:

```ts
URL.revokeObjectURL(previewUrl);
```

Do not:

- convert the file to Base64 in the browser;
- send filenames or image URLs in recommendation requests;
- persist the image in web storage;
- send multiple image form fields;
- trust only file extensions.

The backend decodes, validates, sanitizes, and discards image bytes.

## Security and privacy rules

Frontend implementations must:

- describe all results as preliminary and non-diagnostic;
- never suppress emergency or urgent backend messages;
- never call recommendation generation for blocked safety;
- never derive treatment instructions from a preliminary condition;
- never expose `CORTEX_API_KEY`, `LLM_API_KEY`, or any server secret;
- never place provider keys in `NEXT_PUBLIC_*`;
- never display raw provider responses;
- never log image data, questionnaire answers, contact details, or complete API
  responses to analytics by default;
- avoid sending assessment data to third-party error trackers without explicit
  redaction and approval;
- treat referral contact details as sensitive;
- clear stale assessment IDs after `ASSESSMENT_NOT_FOUND`.

## Integration checklist

Before considering a frontend integration complete:

- [ ] `NEXT_PUBLIC_API_BASE_URL` points to the intended backend.
- [ ] The frontend origin is allowed by backend CORS.
- [ ] A new assessment is created before image upload.
- [ ] Image upload uses `FormData` field name `image`.
- [ ] Browser code does not manually set multipart `Content-Type`.
- [ ] Retake-required assessments never proceed to questionnaire/recommendation.
- [ ] Every questionnaire field is submitted with an explicit value.
- [ ] The recommendation endpoint is called only for `allowed`.
- [ ] Blocked paths render backend `SafetyFeedback`.
- [ ] Result pages can reload using `GET /v1/assessments/{id}`.
- [ ] Stable error codes drive user-friendly messages.
- [ ] Request IDs are retained for support diagnostics.
- [ ] Image preview object URLs are revoked.
- [ ] Only the assessment ID is stored in session storage.
- [ ] Referral UI does not claim delivery to a care team that is not integrated.
- [ ] No secret or image data is included in browser logs or analytics.
- [ ] The frontend handles loss of in-memory assessment state.
- [ ] The production frontend origin is added to CORS before deployment.
