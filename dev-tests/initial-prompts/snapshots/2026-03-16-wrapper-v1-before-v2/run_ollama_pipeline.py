#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def read_text(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8").strip()


def ensure_outputs(outputs_dir: Path) -> None:
    outputs_dir.mkdir(parents=True, exist_ok=True)


def extract_json(text: str) -> dict:
    fenced = re.findall(r"```json\s*(\{.*?\})\s*```", text, flags=re.S)
    candidates = fenced or []
    if not candidates:
        first = text.find("{")
        last = text.rfind("}")
        if first == -1 or last == -1 or last <= first:
            raise ValueError("No JSON object found in model response.")
        candidates = [text[first:last + 1]]

    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception as exc:
            last_error = exc
    raise ValueError(f"Unable to parse model JSON output: {last_error}")


def validate_phase_output(phase_name: str, payload: dict) -> None:
    uncertainties = payload.get("uncertainties", [])
    if not isinstance(uncertainties, list) or any(not isinstance(item, str) for item in uncertainties):
        raise ValueError(f"{phase_name} uncertainties must be a list of strings.")

    if phase_name == "phase-2":
        required = {"candidate_records", "candidate_artifacts", "uncertainties"}
        if set(payload.keys()) != required:
            extra = sorted(set(payload.keys()) - required)
            missing = sorted(required - set(payload.keys()))
            raise ValueError(f"{phase_name} output must contain exactly {sorted(required)}; missing={missing}, extra={extra}")
        record_ids = [item["candidate_id"] for item in payload.get("candidate_records", [])]
        artifact_ids = [item["candidate_id"] for item in payload.get("candidate_artifacts", [])]
        combined_ids = record_ids + artifact_ids
        if len(set(combined_ids)) != len(combined_ids):
            raise ValueError(f"{phase_name} output has duplicate candidate_id values across records/artifacts: {combined_ids}")
    elif phase_name == "phase-3":
        required = {"candidate_references", "uncertainties"}
        if set(payload.keys()) != required:
            extra = sorted(set(payload.keys()) - required)
            missing = sorted(required - set(payload.keys()))
            raise ValueError(f"{phase_name} output must contain exactly {sorted(required)}; missing={missing}, extra={extra}")
    elif phase_name == "phase-4":
        required = {
            "candidate_records",
            "candidate_artifacts",
            "candidate_references",
            "removed_items",
            "soft_groups",
            "uncertainties",
        }
        if set(payload.keys()) != required:
            extra = sorted(set(payload.keys()) - required)
            missing = sorted(required - set(payload.keys()))
            raise ValueError(f"{phase_name} output must contain exactly {sorted(required)}; missing={missing}, extra={extra}")
    else:
        raise ValueError(f"Unknown phase name: {phase_name}")


def run_ollama(model: str, prompt: str, think_mode: str, stream: bool, stage_name: str) -> str:
    proc = subprocess.Popen(
        ["ollama", "run", model, "--think", think_mode, "--format", "json"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    assert proc.stdin is not None
    proc.stdin.write(prompt)
    proc.stdin.close()

    assert proc.stdout is not None
    output_chunks = []
    if stream:
        print(f"\n===== {stage_name} ({model}, think={think_mode}) =====\n", flush=True)
    while True:
        chunk = proc.stdout.read(1)
        if chunk == "":
            break
        output_chunks.append(chunk)
        if stream:
            sys.stdout.write(chunk)
            sys.stdout.flush()

    stderr_text = ""
    if proc.stderr is not None:
        stderr_text = proc.stderr.read()

    return_code = proc.wait()
    if stream:
        print("\n", flush=True)

    if return_code != 0:
        raise RuntimeError(stderr_text.strip() or f"ollama run failed with code {return_code}")
    return "".join(output_chunks)


def save(outputs_dir: Path, name: str, text: str) -> None:
    (outputs_dir / name).write_text(text, encoding="utf-8")


def build_phase_2_request(prompt: str, entry: str) -> str:
    return (
        f"{prompt}\n\n"
        f"<journal_entry>\n{entry}\n</journal_entry>\n\n"
        f"Return only the final JSON object.\n"
    )


def build_phase_3_request(prompt: str, entry: str, phase2: dict) -> str:
    return (
        f"{prompt}\n\n"
        f"<journal_entry>\n{entry}\n</journal_entry>\n\n"
        f"<phase_2_json>\n{json.dumps(phase2, ensure_ascii=False, separators=(',', ':'))}\n</phase_2_json>\n\n"
        f"Return only the final JSON object.\n"
    )


def build_phase_4_request(prompt: str, entry: str, phase2: dict, phase3: dict) -> str:
    return (
        f"{prompt}\n\n"
        f"<journal_entry>\n{entry}\n</journal_entry>\n\n"
        f"<phase_2_json>\n{json.dumps(phase2, ensure_ascii=False, separators=(',', ':'))}\n</phase_2_json>\n\n"
        f"<phase_3_json>\n{json.dumps(phase3, ensure_ascii=False, separators=(',', ':'))}\n</phase_3_json>\n\n"
        f"Return only the final JSON object.\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3:4b")
    parser.add_argument("--think", default="false", help="Ollama thinking mode: false, low, medium, or high")
    parser.add_argument("--stream", action="store_true", help="Stream raw model output to the terminal while saving it")
    parser.add_argument("--output-dir", default="outputs", help="Directory under this harness folder where run artifacts will be saved")
    args = parser.parse_args()

    outputs_dir = ROOT / args.output_dir
    ensure_outputs(outputs_dir)

    phase2_prompt = read_text("phase-2-prompt.txt")
    phase3_prompt = read_text("phase-3-prompt.txt")
    phase4_prompt = read_text("phase-4-prompt.txt")
    entry = read_text("large-difficult-entry.txt")

    # Phase 2
    req2 = build_phase_2_request(phase2_prompt, entry)
    save(outputs_dir, "phase-2-request.txt", req2)
    raw2 = run_ollama(args.model, req2, args.think, args.stream, "phase-2")
    save(outputs_dir, "phase-2-raw.txt", raw2)
    phase2 = extract_json(raw2)
    validate_phase_output("phase-2", phase2)
    save(outputs_dir, "phase-2.json", json.dumps(phase2, indent=2, ensure_ascii=False))

    # Phase 3
    req3 = build_phase_3_request(phase3_prompt, entry, phase2)
    save(outputs_dir, "phase-3-request.txt", req3)
    raw3 = run_ollama(args.model, req3, args.think, args.stream, "phase-3")
    save(outputs_dir, "phase-3-raw.txt", raw3)
    phase3 = extract_json(raw3)
    validate_phase_output("phase-3", phase3)
    save(outputs_dir, "phase-3.json", json.dumps(phase3, indent=2, ensure_ascii=False))

    # Phase 4
    req4 = build_phase_4_request(phase4_prompt, entry, phase2, phase3)
    save(outputs_dir, "phase-4-request.txt", req4)
    raw4 = run_ollama(args.model, req4, args.think, args.stream, "phase-4")
    save(outputs_dir, "phase-4-raw.txt", raw4)
    phase4 = extract_json(raw4)
    validate_phase_output("phase-4", phase4)
    save(outputs_dir, "phase-4.json", json.dumps(phase4, indent=2, ensure_ascii=False))

    summary = {
      "model": args.model,
      "phase_2_candidate_records": len(phase2.get("candidate_records", [])),
      "phase_2_candidate_artifacts": len(phase2.get("candidate_artifacts", [])),
      "phase_3_candidate_references": len(phase3.get("candidate_references", [])),
      "phase_4_candidate_records": len(phase4.get("candidate_records", [])),
      "phase_4_candidate_artifacts": len(phase4.get("candidate_artifacts", [])),
      "phase_4_candidate_references": len(phase4.get("candidate_references", [])),
      "phase_4_removed_items": len(phase4.get("removed_items", [])),
      "phase_4_soft_groups": len(phase4.get("soft_groups", [])),
    }
    save(outputs_dir, "summary.json", json.dumps(summary, indent=2, ensure_ascii=False))

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
