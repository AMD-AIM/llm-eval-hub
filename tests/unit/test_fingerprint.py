import pytest

from packages.eval_engine.fingerprint import canonical_json, protocol_fingerprint


def test_fingerprint_is_stable_across_mapping_order() -> None:
    left = {"protocol": {"parser": "v1", "labels": ["a", "b"]}, "temperature": 0}
    right = {"temperature": 0, "protocol": {"labels": ["a", "b"], "parser": "v1"}}

    assert canonical_json(left) == canonical_json(right)
    assert protocol_fingerprint(left) == protocol_fingerprint(right)


def test_fingerprint_changes_when_protocol_changes() -> None:
    baseline = {"dataset_checksum": "abc", "parser": {"version": "1"}}
    changed = {"dataset_checksum": "abc", "parser": {"version": "2"}}

    assert protocol_fingerprint(baseline) != protocol_fingerprint(changed)


def test_fingerprint_rejects_non_finite_values() -> None:
    with pytest.raises(ValueError, match="NaN or infinity"):
        canonical_json({"temperature": float("nan")})
