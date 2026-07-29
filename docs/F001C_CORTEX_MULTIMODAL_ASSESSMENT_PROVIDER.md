# F001C — Cortex Guarded Multimodal Assessment Provider

**Implementation status:** complete and configuration-gated<br>
**Implemented:** 2026-07-29<br>
**Default provider:** `mock`<br>
**Live rollout approval:** pending

## 1. Architecture

F001C adds `CortexMultimodalAssessmentProvider` behind the F001A `ImageAssessmentProvider` interface. It does not change the public API, frontend types, `ProviderAssessmentDraft`, `ImageAssessmentResult`, repository, deterministic safety rules, recommendation input, or image lifecycle.

```text
validated and sanitized ValidatedImage
  -> ImageAssessmentProvider
     -> MockImageAssessmentProvider (default)
     -> CortexMultimodalAssessmentProvider (explicit configuration)
        -> guarded prompt + inlineData + responseSchema
        -> strict ProviderAssessmentDraft
  -> existing application normalization
  -> backend-owned ImageAssessmentResult
```

The implementation lives in:

- `backend/app/infrastructure/assessment/cortex.py`
- `backend/app/infrastructure/assessment/prompt.py`
- `backend/app/infrastructure/assessment/factory.py`

The existing `POST /v1/assessments/{assessment_id}/image-assessment` route and application service remain provider-neutral.

## 2. Cortex Endpoint Contract

The provider sends:

```text
POST {CORTEX_BASE_URL}/v1/models/{CORTEX_IMAGE_MODEL}:generateContent
Content-Type: application/json
x-api-key: <server-side CORTEX_API_KEY>
```

Defaults resolve to:

```text
https://cortex-ai-gateway-zo7vz3jvhq-uc.a.run.app/v1/models/gemini-2.5-flash:generateContent
```

The API key is never placed in the URL. The base URL validator rejects credentials, query strings, and fragments. The model alias accepts only letters, digits, `.`, `_`, and `-`, preventing path construction from arbitrary input.

## 3. Request Structure

The guarded prompt and sanitized image are separate sibling parts:

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "<image-assessment-v1 prompt>"
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "<standard-base64-redacted>"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 800,
    "responseMimeType": "application/json",
    "responseSchema": "<ProviderAssessmentDraft v1 schema>"
  }
}
```

Each part has one content type. The provider uses `inlineData` with exact `mimeType` and `data` casing and never constructs `fileData`, a provider file, or a public URL.

The existing Cortex recommendation client already uses `generationConfig.responseSchema`, confirming this gateway contract. The assessment schema is independently built from `ProviderAssessmentDraft` fields and the authoritative domain enums. An import-time field-set check fails if the schema and provider draft drift.

## 4. Image and Size Controls

The provider accepts only the F001A `ValidatedImage`, containing metadata-free sanitized bytes and verified dimensions/MIME. Supported MIME types are:

- `image/jpeg`
- `image/png`
- `image/webp`

Base64 is created only while building the outbound request. The request payload is released immediately after transport completes. The implementation does not retain raw bytes, Base64, or the response envelope.

Cortex's supplied inline image cap is 20 MiB. Because Base64 expands input by approximately one third, F001C verifies the encoded inline value does not exceed 20 MiB before transport. SkinSense's application upload limit remains 8 MiB and was not increased:

```text
IMAGE_ASSESSMENT_MAX_BYTES=8388608
```

The F001A validator continues to enforce byte, decoded-pixel, minimum-side, actual-format, MIME-match, corruption, EXIF-orientation, metadata removal, and resource-cleanup requirements before Cortex is invoked.

## 5. Guarded Prompt and Schema

Prompt version: `image-assessment-v1`<br>
Schema version: `v1`

The prompt requires Cortex to:

- perform a preliminary visual assessment only;
- avoid diagnostic claims;
- select only an authoritative condition, using `other_or_uncertain` to abstain;
- describe only approved visible findings;
- avoid inventing symptoms or medical history;
- avoid inferring race, ethnicity, nationality, identity, gender, or age;
- avoid treatment, medication, dosage, product, or duration advice;
- use only approved image-quality issues, follow-up IDs, and visual-safety signals;
- return exactly one JSON object and no Markdown or surrounding prose;
- omit every backend-owned field.

The prompt contains no referral details, previous recommendations, secrets, repository data, unstructured medical history, or user-facing medical guidance.

The schema constrains:

- conditions and alternative conditions;
- confidence levels and optional bounded score;
- controlled visual findings;
- quality status/issues;
- follow-up question IDs;
- visual safety signals;
- maximum list sizes;
- required fields;
- and additional properties.

Pydantic then validates `ProviderAssessmentDraft` again, including cross-field rules. The application service remains responsible for normalization, engine identity, limitations, timestamps, prompt version, unknown fallback, recommendation status, and all safety decisions.

## 6. Response Parsing

The parser requires one candidate with one non-empty text part under:

```text
candidates[0].content.parts[0].text
```

It then:

1. validates the outer JSON envelope;
2. rejects missing, empty, or multiple candidate text parts;
3. rejects Markdown code fences;
4. parses the complete text as JSON without substring extraction;
5. requires a JSON object;
6. validates it strictly as `ProviderAssessmentDraft`;
7. returns only that draft.

Raw Cortex envelopes and raw provider errors are never returned or persisted.

## 7. Timeout, Retry, and Failure Mapping

The entire provider call is bounded by `IMAGE_ASSESSMENT_TIMEOUT_SECONDS`. At most one retry is allowed, and the overall deadline is divided across the available attempts rather than multiplied by retry count.

Retried once:

- timeout;
- connection/URL failure;
- HTTP `429`;
- HTTP `500`, `502`, `503`, or `504`.

Not retried:

- HTTP `400`, `401`, `403`, or `404`;
- successful but invalid envelopes;
- empty output;
- malformed JSON;
- schema-invalid output;
- unsupported sanitized MIME;
- encoded inline request over the Cortex cap.

Mappings:

| Failure | Typed exception |
|---|---|
| Timeout exhaustion | `AssessmentProviderTimeout` |
| Connection, 429, 5xx, 401/403/404 | `AssessmentProviderUnavailable` |
| Request/configuration 4xx | `AssessmentProviderOutputInvalid` |
| Invalid envelope/JSON/schema | `AssessmentProviderOutputInvalid` |
| Unsupported MIME/inline size | `AssessmentProviderOutputInvalid` before transport |

The public route continues to translate these typed exceptions into the existing stable error envelope. HTTP error bodies are never read into exception strings.

## 8. Configuration and Provider Selection

```text
IMAGE_ASSESSMENT_PROVIDER=mock
IMAGE_ASSESSMENT_PROMPT_VERSION=image-assessment-v1
IMAGE_ASSESSMENT_SCHEMA_VERSION=v1
IMAGE_ASSESSMENT_TIMEOUT_SECONDS=20
IMAGE_ASSESSMENT_MAX_RETRIES=1
IMAGE_ASSESSMENT_MAX_OUTPUT_TOKENS=800
IMAGE_ASSESSMENT_TEMPERATURE=0.1
CORTEX_API_KEY=
CORTEX_BASE_URL=https://cortex-ai-gateway-zo7vz3jvhq-uc.a.run.app
CORTEX_IMAGE_MODEL=gemini-2.5-flash
```

To select Cortex, inject the server-side secret and set:

```text
IMAGE_ASSESSMENT_PROVIDER=cortex
```

Do not expose `CORTEX_API_KEY` through `NEXT_PUBLIC_*`, frontend configuration, URLs, logs, or checked-in `.env` files.

To revert immediately:

```text
IMAGE_ASSESSMENT_PROVIDER=mock
```

No route, frontend, safety, recommendation, or data migration is needed when switching providers.

## 9. Privacy and Logging Controls

Implemented controls:

- only sanitized, metadata-free image bytes reach Cortex;
- no raw/sanitized byte repository;
- no Base64, payload, response envelope, API key, error body, or image content logging;
- no public image URL or provider file upload;
- no API key in URL;
- fixed sanitized application exceptions;
- one request-time image only;
- normalized assessment result persistence only.

Still requiring organizational approval before live use:

- Cortex input/output retention and deletion terms;
- whether inputs or outputs are used for provider training;
- processing region and cross-border data transfer;
- data-processing agreement and subprocessor review;
- gateway, load balancer, Cloud Run, APM, and proxy body-logging configuration;
- least-privilege secret storage, rotation, and access audit;
- consent language and deletion/incident procedures;
- permitted user cohort and clinical oversight.

## 10. Automated Tests

All network behavior is mocked. No automated test calls Cortex.

F001C coverage includes:

- endpoint, model alias, headers, and API-key location;
- separate text and `inlineData` parts with exact casing;
- sanitized byte/Base64 equality and original-byte exclusion;
- JPEG, PNG, and WebP transfer;
- absence of `fileData`;
- response MIME, temperature, token limit, and response schema;
- supported, uncertain, and retake results;
- empty/invalid envelopes, malformed/fenced JSON, extras, missing fields, and invalid enums;
- unsupported MIME and encoded-size rejection before transport;
- timeout, connection, 429, 500, 400, and 401 behavior;
- bounded retry counts;
- API-key, Base64, and provider-body log/exception secrecy;
- mock default and Cortex configuration selection;
- unchanged endpoint schema and normalized-only repository;
- prompt controlled vocabularies and version rejection;
- the complete F001A regression suite.

## 11. Opt-in Smoke Test

Use only a synthetic, public-domain, or explicitly consented image. Inject all Cortex settings through an approved local secret mechanism, then run:

```bash
cd backend
IMAGE_ASSESSMENT_PROVIDER=cortex .venv/bin/python scripts/smoke_cortex_assessment.py /path/to/approved-test-image.jpg
```

The command uses the production validator and provider/application service. It prints only normalized condition, qualitative confidence, image-quality status/issues, approved findings, approved follow-up IDs, approved safety-signal codes, engine alias/version, prompt/schema versions, and latency.

It does not print Base64, bytes, payload, raw response, API key, or the image path. Without explicit Cortex selection and an API key, it exits before reading the image.

To exercise both separate Cortex invocations through the public API, use the
explicitly synthetic routine/no-red-flag questionnaire profile:

```bash
cd backend
.venv/bin/python scripts/smoke_cortex_cycle.py test_pics/image.png \
  --use-synthetic-routine-questionnaire
```

This command runs image assessment, questionnaire validation, deterministic
safety, and recommendation generation in sequence. The synthetic answers are
test data and must not be interpreted as medical history belonging to the
person pictured. Recommendation is not invoked if safety blocks it.

## 12. Dependency Verification

F001C adds no transport SDK or new dependency. It uses the Python standard-library HTTP transport, matching the existing recommendation client convention.

`HTTPX2==2.9.1` in `backend/requirements.txt` is an actual installed test dependency, not a reporting typo. The test client imports `httpx2` directly for async ASGI transport. `pip check` reports no broken requirements.

## 13. Known Limitations

- Cortex is implemented but intentionally disabled by default.
- No live smoke test can run without an approved secret and approved image.
- Provider output confidence remains uncalibrated and is qualitative in the UI.
- No clinical accuracy, abstention, quality, fairness, or skin-tone evaluation has been completed.
- The prompt/schema and controlled visual vocabulary still require clinical sign-off.
- State remains unauthenticated, process-local, in-memory, and without TTL.
- No production rate limiting, cost quota, deployment configuration, or observability audit exists.
- One image only; no multi-angle or multi-image inference.
- Standard-library thread-backed transport cannot forcibly terminate an already-running socket thread when its outer asynchronous deadline is cancelled; the socket timeout still bounds that request.

## 14. Exact Next Task

Implement **F001G — Governed Cortex Evaluation and Rollout Gate**:

1. complete Cortex privacy, retention, training-use, region, DPA, and subprocessor approval;
2. store/rotate a least-privilege assessment-only secret in the deployment secret manager;
3. clinically approve prompt `image-assessment-v1`, schema `v1`, controlled vocabularies, safety copy, and intended use;
4. build a governed evaluation harness using synthetic and explicitly consented representative images;
5. measure accuracy, abstention, retake quality, safety-signal recall, calibration, latency, cost, and performance across relevant skin tones/devices;
6. define acceptance thresholds and a monitored rollback criterion;
7. add rate limits, cost quotas, production body-log suppression, redaction verification, metrics, and deployment configuration;
8. keep `IMAGE_ASSESSMENT_PROVIDER=mock` until every approval and acceptance gate is recorded.
