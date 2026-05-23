#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path

from run_ollama_pipeline import canonical_event_text


WEAK_REFERENCE_LABELS = {
    "part-of",
    "contains",
    "mentions",
    "mentioned",
    "object",
    "same",
    "described event",
    "described object",
    "action object",
    "belongs_to",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def norm(text: str) -> str:
    return canonical_event_text(text)


def lexical_tokens(text: str):
    return {
        token
        for token in re.findall(r"[A-Za-z']+", text.lower())
        if token not in {"the", "a", "an", "to", "of", "and", "or", "i", "my", "it", "me", "at", "on", "in", "for"}
    }


def artifact_text(item: dict) -> str:
    return item["source_text"] if item["artifact_kind"] == "object" else item["source_texts"][0]


def is_overbroad_encounter(text: str) -> bool:
    lowered = text.lower()
    word_count = len(re.findall(r"\S+", text))
    has_author_process = " i " in f" {lowered} " and re.search(
        r"\b(reread|printed|admitted|apologized|opened|stared|wanted|knew|told|read|deleted|restored|hearing|replaying|wrote|rewrote|underlined|decide|forgive|call)\b",
        lowered,
    )
    return word_count >= 9 and has_author_process


def record_contains_subrecord(parent: str, child: str) -> bool:
    parent_l = parent.lower()
    child_l = child.lower()
    if parent_l == child_l:
        return False
    return child_l in parent_l or f"and {child_l}" in parent_l or f"and then {child_l}" in parent_l or f"but {child_l}" in parent_l


def evaluate_case(output_dir: Path, spec_path: Path) -> dict:
    spec = load_json(spec_path)
    phase1 = load_json(output_dir / "phase-1.json")
    phase2 = load_json(output_dir / "phase-2.json")

    expected_records = spec.get("expected_records", [])
    expected_artifacts = spec.get("expected_artifacts", [])
    expected_reference_pairs = spec.get("expected_reference_pairs", [])
    forbidden_records = spec.get("forbidden_records", [])
    forbidden_artifacts = spec.get("forbidden_artifacts", [])
    forbidden_reference_pairs = spec.get("forbidden_reference_pairs", [])

    record_texts = {norm(item["source_text"]) for item in phase1["candidate_records"]}
    artifact_texts = {norm(artifact_text(item)) for item in phase1["candidate_artifacts"]}

    missing_records = [text for text in expected_records if norm(text) not in record_texts]
    missing_artifacts = [text for text in expected_artifacts if norm(text) not in artifact_texts]
    forbidden_records_present = [text for text in forbidden_records if norm(text) in record_texts]
    forbidden_artifacts_present = [text for text in forbidden_artifacts if norm(text) in artifact_texts]

    record_map = {item["candidate_id"]: item["source_text"] for item in phase1["candidate_records"]}
    artifact_map = {item["candidate_id"]: artifact_text(item) for item in phase1["candidate_artifacts"]}
    ref_pairs = {
        (norm(record_map[ref["from_candidate_id"]]), norm(artifact_map[ref["to_candidate_id"]]))
        for ref in phase2["candidate_references"]
        if ref["from_candidate_id"] in record_map and ref["to_candidate_id"] in artifact_map
    }

    missing_reference_pairs = []
    for pair in expected_reference_pairs:
        key = (norm(pair["record"]), norm(pair["artifact"]))
        if key not in ref_pairs:
            missing_reference_pairs.append(pair)

    forbidden_reference_hits = []
    for pair in forbidden_reference_pairs:
        key = (norm(pair["record"]), norm(pair["artifact"]))
        if key in ref_pairs:
            forbidden_reference_hits.append(pair)

    overbroad_encounters = sum(
        1
        for item in phase1["candidate_artifacts"]
        if item["artifact_kind"] == "encounter" and is_overbroad_encounter(artifact_text(item))
    )
    encounter_count = sum(1 for item in phase1["candidate_artifacts"] if item["artifact_kind"] == "encounter")
    unexpected_encounters = max(0, encounter_count - int(spec.get("max_encounters", encounter_count)))

    composite_records = 0
    for item in phase1["candidate_records"]:
        child_count = sum(
            1
            for other in phase1["candidate_records"]
            if other is not item
            and len(other["source_text"]) < len(item["source_text"])
            and record_contains_subrecord(item["source_text"], other["source_text"])
        )
        if child_count >= 2:
            composite_records += 1

    weak_refs = 0
    for ref in phase2["candidate_references"]:
        record_text = record_map.get(ref["from_candidate_id"], "")
        target_text = artifact_map.get(ref["to_candidate_id"], "")
        support = ref["supporting_text"]
        overlap = lexical_tokens(support) & lexical_tokens(target_text)
        if (
            ref["relation_label"] in WEAK_REFERENCE_LABELS
            or len(lexical_tokens(support)) < 2
            or (len(overlap) == 0 and target_text.lower() not in support.lower() and target_text.lower() not in record_text.lower())
        ):
            weak_refs += 1

    record_recall = 1.0 if not expected_records else (len(expected_records) - len(missing_records)) / len(expected_records)
    artifact_recall = 1.0 if not expected_artifacts else (len(expected_artifacts) - len(missing_artifacts)) / len(expected_artifacts)
    ref_recall = 1.0 if not expected_reference_pairs else (len(expected_reference_pairs) - len(missing_reference_pairs)) / len(expected_reference_pairs)

    target_reference_count = int(spec.get("target_reference_count", max(1, len(expected_reference_pairs))))
    count_penalty = abs(len(phase2["candidate_references"]) - target_reference_count) * 0.5
    forbidden_penalty = (
        len(forbidden_records_present) * 5
        + len(forbidden_artifacts_present) * 4
        + len(forbidden_reference_hits) * 5
    )
    score = (
        record_recall * 40
        + artifact_recall * 25
        + ref_recall * 35
        - overbroad_encounters * 8
        - unexpected_encounters * 4
        - composite_records * 6
        - weak_refs * 2
        - count_penalty
        - forbidden_penalty
    )

    return {
        "case_id": spec["case_id"],
        "description": spec.get("description", ""),
        "output_dir": str(output_dir),
        "phase_1_records": len(phase1["candidate_records"]),
        "phase_1_artifacts": len(phase1["candidate_artifacts"]),
        "phase_2_references": len(phase2["candidate_references"]),
        "record_recall": round(record_recall, 4),
        "artifact_recall": round(artifact_recall, 4),
        "reference_recall": round(ref_recall, 4),
        "overbroad_encounters": overbroad_encounters,
        "unexpected_encounters": unexpected_encounters,
        "composite_records": composite_records,
        "weak_references": weak_refs,
        "missing_records": missing_records,
        "missing_artifacts": missing_artifacts,
        "missing_reference_pairs": missing_reference_pairs,
        "forbidden_records_present": forbidden_records_present,
        "forbidden_artifacts_present": forbidden_artifacts_present,
        "forbidden_reference_hits": forbidden_reference_hits,
        "score": round(score, 4)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    parser.add_argument("spec_path")
    args = parser.parse_args()
    result = evaluate_case(Path(args.output_dir), Path(args.spec_path))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
