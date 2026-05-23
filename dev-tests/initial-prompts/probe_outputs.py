#!/usr/bin/env python3

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
def load_json(outputs_dir: Path, name: str):
    path = outputs_dir / name
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def duplicate_values(values):
    counts = Counter(values)
    return sorted([value for value, count in counts.items() if count > 1])


def graph_metrics(nodes, edges):
    und = defaultdict(set)
    for source, target in edges:
        und[source].add(target)
        und[target].add(source)
    for node in nodes:
        und[node]

    seen = set()
    component_sizes = []
    isolates = []
    for node in nodes:
        if node in seen:
            continue
        stack = [node]
        seen.add(node)
        size = 0
        while stack:
            current = stack.pop()
            size += 1
            for nxt in und[current]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        component_sizes.append(size)
    component_sizes.sort(reverse=True)

    for node in nodes:
        if not und[node]:
            isolates.append(node)

    n = len(nodes)
    m = len(edges)
    avg_degree = (2 * m / n) if n else 0.0
    largest = component_sizes[0] if component_sizes else 0
    return {
        "nodes": n,
        "edges": m,
        "components": len(component_sizes),
        "component_sizes": component_sizes,
        "largest_component_size": largest,
        "largest_component_pct": (largest * 100 / n) if n else 0.0,
        "isolates": isolates,
        "avg_degree": avg_degree,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="outputs", help="Directory under this harness folder containing phase outputs")
    args = parser.parse_args()

    outputs_dir = ROOT / args.output_dir
    entry = (ROOT / "large-difficult-entry.txt").read_text(encoding="utf-8")
    phase2 = load_json(outputs_dir, "phase-2.json")
    phase3 = load_json(outputs_dir, "phase-3.json")
    phase4 = load_json(outputs_dir, "phase-4.json")

    if phase2 is None:
        raise FileNotFoundError(f"Missing {outputs_dir / 'phase-2.json'}")

    phase2_record_ids = [item["candidate_id"] for item in phase2.get("candidate_records", [])]
    phase2_artifact_ids = [item["candidate_id"] for item in phase2.get("candidate_artifacts", [])]
    phase2_ids = set(phase2_record_ids + phase2_artifact_ids)

    phase3_ref_ids = [item["candidate_reference_id"] for item in phase3.get("candidate_references", [])] if phase3 else []
    phase3_bad_refs = []
    for item in phase3.get("candidate_references", []) if phase3 else []:
        if item["from_candidate_id"] not in phase2_ids or item["to_candidate_id"] not in phase2_ids:
            phase3_bad_refs.append(item["candidate_reference_id"])

    phase4_record_ids = [item["candidate_id"] for item in phase4.get("candidate_records", [])] if phase4 else []
    phase4_artifact_ids = [item["candidate_id"] for item in phase4.get("candidate_artifacts", [])] if phase4 else []
    phase4_ids = set(phase4_record_ids + phase4_artifact_ids)
    phase4_ref_ids = [item["candidate_reference_id"] for item in phase4.get("candidate_references", [])] if phase4 else []

    phase4_bad_refs = []
    phase4_missing_support = []
    for item in phase4.get("candidate_references", []) if phase4 else []:
        if item["from_candidate_id"] not in phase4_ids or item["to_candidate_id"] not in phase4_ids:
            phase4_bad_refs.append(item["candidate_reference_id"])
        if item["supporting_text"] not in entry:
            phase4_missing_support.append(item["candidate_reference_id"])

    phase2_nodes = phase2_record_ids + phase2_artifact_ids
    phase3_edges = [(item["from_candidate_id"], item["to_candidate_id"]) for item in phase3.get("candidate_references", [])] if phase3 else []
    phase4_nodes = phase4_record_ids + phase4_artifact_ids
    phase4_edges = [(item["from_candidate_id"], item["to_candidate_id"]) for item in phase4.get("candidate_references", [])] if phase4 else []

    report = {
        "stage_status": {
            "phase_2_json_present": phase2 is not None,
            "phase_3_json_present": phase3 is not None,
            "phase_4_json_present": phase4 is not None,
            "phase_3_has_candidate_references": bool(phase3 and "candidate_references" in phase3),
            "phase_4_has_expected_top_level_keys": bool(
                phase4
                and "candidate_records" in phase4
                and "candidate_artifacts" in phase4
                and "candidate_references" in phase4
            ),
        },
        "counts": {
            "phase_2_candidate_records": len(phase2_record_ids),
            "phase_2_candidate_artifacts": len(phase2_artifact_ids),
            "phase_3_candidate_references": len(phase3_ref_ids),
            "phase_4_candidate_records": len(phase4_record_ids),
            "phase_4_candidate_artifacts": len(phase4_artifact_ids),
            "phase_4_candidate_references": len(phase4_ref_ids),
            "phase_4_removed_items": len(phase4.get("removed_items", [])) if phase4 else 0,
            "phase_4_soft_groups": len(phase4.get("soft_groups", [])) if phase4 else 0,
        },
        "duplicates": {
            "phase_2_candidate_ids": duplicate_values(phase2_record_ids + phase2_artifact_ids),
            "phase_3_candidate_reference_ids": duplicate_values(phase3_ref_ids),
            "phase_4_candidate_ids": duplicate_values(phase4_record_ids + phase4_artifact_ids),
            "phase_4_candidate_reference_ids": duplicate_values(phase4_ref_ids),
        },
        "reference_integrity": {
            "phase_3_references_with_missing_candidates": phase3_bad_refs,
            "phase_4_references_with_missing_candidates": phase4_bad_refs,
            "phase_4_references_with_support_not_found_in_entry": phase4_missing_support,
        },
        "graph": {
            "pre_phase_4": graph_metrics(phase2_nodes, phase3_edges),
            "post_phase_4": graph_metrics(phase4_nodes, phase4_edges),
        },
    }

    (outputs_dir / "probe-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
