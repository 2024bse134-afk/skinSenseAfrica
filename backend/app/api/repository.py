"""API-layer in-memory assessment repository for endpoint orchestration tests.

Single responsibility: store and retrieve assessment workflow state for API handlers.
"""

from __future__ import annotations

from typing import Dict
from uuid import uuid4

from pydantic import BaseModel, Field

from app.domain.recommendation.models import (
    ClassificationResult,
    Questionnaire,
    RecommendationResult,
    SkinContext,
)


class AssessmentRecord(BaseModel):
    """Minimal persisted assessment state used by recommendation endpoint."""

    id: str
    status: str
    classification: ClassificationResult | None = None
    questionnaire: Questionnaire | None = None
    skin_context: SkinContext = Field(default_factory=SkinContext)
    recommendation: RecommendationResult | None = None


class InMemoryAssessmentRepository:
    """Simple in-memory repository for assessment lifecycle state."""

    def __init__(self) -> None:
        self._store: Dict[str, AssessmentRecord] = {}
        # Uploads are deliberately transient and are not part of AssessmentRecord.
        self._images: Dict[str, tuple[bytes, str]] = {}

    def get(self, assessment_id: str) -> AssessmentRecord | None:
        return self._store.get(assessment_id)

    def upsert(self, record: AssessmentRecord) -> None:
        self._store[record.id] = record

    def create(self) -> AssessmentRecord:
        record = AssessmentRecord(id=str(uuid4()), status="draft")
        self.upsert(record)
        return record

    def save_image(self, assessment_id: str, image: bytes, content_type: str) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None
        self._images[assessment_id] = (image, content_type)
        record.status = "image_uploaded"
        return record

    def get_image(self, assessment_id: str) -> tuple[bytes, str] | None:
        return self._images.get(assessment_id)

    def save_classification(
        self, assessment_id: str, classification: ClassificationResult
    ) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None
        record.classification = classification
        record.status = "classified"
        return record

    def save_questionnaire(
        self, assessment_id: str, questionnaire: Questionnaire
    ) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None
        record.questionnaire = questionnaire
        record.status = "questionnaire_completed"
        return record

    def save_recommendation(
        self,
        assessment_id: str,
        recommendation: RecommendationResult,
        next_status: str,
    ) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None

        record.recommendation = recommendation
        record.status = next_status
        self._store[assessment_id] = record
        return record


class ReferralRecord(BaseModel):
    """Transient prototype referral request."""

    id: str
    assessment_id: str
    name: str
    contact: str
    reason: str
    status: str = "received"


class InMemoryReferralRepository:
    """Simple in-memory referral request store for the prototype."""

    def __init__(self) -> None:
        self._store: Dict[str, ReferralRecord] = {}

    def create(self, assessment_id: str, name: str, contact: str, reason: str) -> ReferralRecord:
        record = ReferralRecord(
            id=str(uuid4()),
            assessment_id=assessment_id,
            name=name,
            contact=contact,
            reason=reason,
        )
        self._store[record.id] = record
        return record
