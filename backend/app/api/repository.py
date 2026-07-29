"""API-layer in-memory assessment repository for endpoint orchestration tests.

Single responsibility: store and retrieve assessment workflow state for API handlers.
"""

from __future__ import annotations

from typing import Dict
from uuid import uuid4

from pydantic import BaseModel, Field

from app.domain.assessment.models import ImageAssessmentResult
from app.domain.questionnaire.models import Questionnaire
from app.domain.recommendation.models import RecommendationResult, SkinContext
from app.domain.safety.models import SafetyResult


class AssessmentRecord(BaseModel):
    """Minimal persisted assessment state used by recommendation endpoint."""

    id: str
    status: str
    assessment: ImageAssessmentResult | None = None
    questionnaire: Questionnaire | None = None
    safety: SafetyResult | None = None
    skin_context: SkinContext = Field(default_factory=SkinContext)
    recommendation: RecommendationResult | None = None


class InMemoryAssessmentRepository:
    """Simple in-memory repository for assessment lifecycle state."""

    def __init__(self) -> None:
        self._store: Dict[str, AssessmentRecord] = {}

    def get(self, assessment_id: str) -> AssessmentRecord | None:
        return self._store.get(assessment_id)

    def upsert(self, record: AssessmentRecord) -> None:
        self._store[record.id] = record

    def create(self) -> AssessmentRecord:
        record = AssessmentRecord(id=str(uuid4()), status="draft")
        self.upsert(record)
        return record

    def save_assessment(
        self, assessment_id: str, assessment: ImageAssessmentResult
    ) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None
        record.assessment = assessment
        record.questionnaire = None
        record.safety = None
        record.recommendation = None
        record.status = (
            "retake_required"
            if assessment.assessment_status.value == "retake_required"
            else "assessment_completed"
        )
        return record

    def save_questionnaire(
        self,
        assessment_id: str,
        questionnaire: Questionnaire,
        safety: SafetyResult,
    ) -> AssessmentRecord | None:
        record = self._store.get(assessment_id)
        if record is None:
            return None
        record.questionnaire = questionnaire
        record.safety = safety
        record.status = {
            "emergency": "emergency",
            "urgent": "urgent",
            "professional_review": "professional_review_required",
            "routine": "questionnaire_completed",
        }[safety.urgency.value]
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
