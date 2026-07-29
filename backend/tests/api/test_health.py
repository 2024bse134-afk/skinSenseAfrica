from tests.http_client import ASGITestClient


def test_health_endpoint() -> None:
    response = ASGITestClient().get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
