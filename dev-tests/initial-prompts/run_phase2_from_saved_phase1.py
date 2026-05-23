#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import run_superpipeline_1_2_3 as sp
from run_ollama_pipeline import ROOT, build_phase4_passthrough, clean_phase3, ensure_outputs, read_text, save


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3.5:9b")
    parser.add_argument("--think", default="false")
    parser.add_argument("--stream", action="store_true")
    parser.add_argument("--phase1-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--entry-file", required=True)
    parser.add_argument("--ollama-timeout-sec", type=int, default=60)
    parser.add_argument("--drop-overbroad-encounters", type=int, default=1)
    parser.add_argument("--strict-object-head-matching", type=int, default=1)
    parser.add_argument("--drop-ambiguous-no-overlap", type=int, default=1)
    parser.add_argument("--drop-weak-no-overlap", type=int, default=1)
    parser.add_argument("--support-min-tokens", type=int, default=3)
    parser.add_argument("--fanout-main", type=int, default=3)
    parser.add_argument("--fanout-minor", type=int, default=2)
    parser.add_argument("--weak-label-penalty", type=int, default=18)
    args = parser.parse_args()

    sp.CONFIG.update(
        {
            "drop_overbroad_encounters": bool(args.drop_overbroad_encounters),
            "strict_object_head_matching": bool(args.strict_object_head_matching),
            "drop_ambiguous_no_overlap": bool(args.drop_ambiguous_no_overlap),
            "drop_weak_no_overlap": bool(args.drop_weak_no_overlap),
            "support_min_tokens": args.support_min_tokens,
            "fanout_main": args.fanout_main,
            "fanout_minor": args.fanout_minor,
            "weak_label_penalty": args.weak_label_penalty,
        }
    )

    phase1_dir = Path(args.phase1_dir)
    if not phase1_dir.is_absolute():
        phase1_dir = ROOT / phase1_dir
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    entry_path = Path(args.entry_file)
    if not entry_path.is_absolute():
        entry_path = ROOT / entry_path

    ensure_outputs(output_dir)
    entry = entry_path.read_text(encoding="utf-8").strip()
    phase1 = load_json(phase1_dir / "phase-1.json")
    units = load_json(phase1_dir / "work-units.json")
    prompt = read_text("super-phase-2-verify-pairs-prompt.txt")

    merged_refs = []
    ref_uncertainties = []
    substep_errors = []
    compact_artifacts = sp.compact_artifacts_for_record_linking(phase1)
    for record in phase1.get("candidate_records", []):
        record_context, candidate_pairs = sp.build_candidate_pairs_for_record(record, compact_artifacts, units)
        candidate_pair_ids = {pair["to_candidate_id"] for pair in candidate_pairs}
        pair_artifacts = [artifact for artifact in compact_artifacts if artifact["candidate_id"] in candidate_pair_ids]
        if candidate_pairs:
            payload, error = sp.safe_run_substep(
                args.model,
                args.think,
                args.stream,
                f"phase-2-links-{record['candidate_id']}",
                prompt,
                [
                    ("source_work_unit_kind", record_context["record_unit"]["unit_kind"]),
                    ("source_work_unit_text", record_context["record_unit"]["unit_text"]),
                    ("local_context_text", record_context["context_text"] or record_context["record_unit"]["unit_text"]),
                    ("source_record_json", json.dumps(record, ensure_ascii=False, separators=(",", ":"))),
                    ("candidate_pairs_json", json.dumps(candidate_pairs, ensure_ascii=False, separators=(",", ":"))),
                ],
                sp.normalize_record_links_payload,
                output_dir,
                f"phase-2-links-{record['candidate_id']}",
                timeout_sec=args.ollama_timeout_sec,
            )
        else:
            payload = {"candidate_references": [], "uncertainties": []}
            error = None
            save(output_dir, f"phase-2-links-{record['candidate_id']}.json", json.dumps(payload, indent=2, ensure_ascii=False))
        payload = sp.merge_reference_payloads(payload, sp.deterministic_links_for_record(record, pair_artifacts, record_context))
        save(output_dir, f"phase-2-links-{record['candidate_id']}.json", json.dumps(payload, indent=2, ensure_ascii=False))
        merged_refs.extend(payload["candidate_references"])
        ref_uncertainties.extend(payload["uncertainties"])
        if error:
            substep_errors.append({"substep": f"phase-2-links-{record['candidate_id']}", "error": error})

    phase2_raw = sp.assign_temp_ids_phase2({"candidate_references": merged_refs, "uncertainties": ref_uncertainties})
    save(output_dir, "phase-2-raw-merged.json", json.dumps(phase2_raw, indent=2, ensure_ascii=False))
    phase2 = clean_phase3(phase2_raw, entry, phase1)
    phase2 = sp.prune_phase2_output(phase2, phase1)
    save(output_dir, "phase-2.json", json.dumps(phase2, indent=2, ensure_ascii=False))

    phase3 = build_phase4_passthrough(phase1, phase2)
    save(output_dir, "phase-3.json", json.dumps(phase3, indent=2, ensure_ascii=False))
    save(output_dir, "substep-errors.json", json.dumps(substep_errors, indent=2, ensure_ascii=False))

    summary = {
        "model": args.model,
        "phase_1_candidate_records": len(phase1.get("candidate_records", [])),
        "phase_1_candidate_artifacts": len(phase1.get("candidate_artifacts", [])),
        "phase_2_candidate_references": len(phase2.get("candidate_references", [])),
        "phase_3_candidate_references": len(phase3.get("candidate_references", [])),
        "substep_error_count": len(substep_errors),
    }
    save(output_dir, "summary.json", json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
