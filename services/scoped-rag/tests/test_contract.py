from pathlib import Path

from luma_scoped_rag.models import SearchResponse


def test_synthetic_typescript_client_contract_validates_against_backend_schema():
    root = Path(__file__).resolve().parents[1]
    example = root / "contracts/search-response.example.json"
    response = SearchResponse.model_validate_json(example.read_text())
    assert response.retrieval == "scoped_pgvector_exact"
    assert response.scope.program_id == "program-synthetic"
    assert len(response.results) == 1
    assert response.results[0].start_clock == "00:00:15"
    assert response.results[0].drive_url.startswith("https://")
