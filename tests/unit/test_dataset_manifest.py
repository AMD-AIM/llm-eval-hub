from pathlib import Path

import pytest

from packages.eval_engine.datasets import DatasetValidationError, validate_dataset

EXAMPLE = Path("datasets/examples/intent-classification/manifest.yaml")


def test_golden_dataset_is_valid_and_materializes_samples() -> None:
    validated = validate_dataset(EXAMPLE)

    assert validated.manifest.metadata.version == "2026.08.1"
    assert len(validated.samples) == 12
    assert validated.samples[0].sample_id == "s-0001"
    assert validated.samples[0].inputs == {"question": "为什么信用卡被扣了两次？"}
    assert validated.samples[0].reference == "billing"


def test_checksum_mismatch_is_rejected(tmp_path: Path) -> None:
    data_path = tmp_path / "changed.jsonl"
    data_path.write_text('{"id":"x","question":"x","label":"billing"}\n', encoding="utf-8")

    with pytest.raises(DatasetValidationError, match="checksum mismatch"):
        validate_dataset(EXAMPLE, data_path)
