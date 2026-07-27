"""Classification application orchestration."""

from app.domain.recommendation.models import ClassificationResult
from app.infrastructure.classifier.client import ClassifierClient


async def classify_uploaded_image(
    image: bytes, content_type: str, client: ClassifierClient
) -> ClassificationResult:
    """Classify one transiently stored image through the configured provider."""

    return await client.classify(image, content_type)
