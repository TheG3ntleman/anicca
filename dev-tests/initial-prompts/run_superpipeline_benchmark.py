#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CASES_ROOT = ROOT / "benchmark-cases"


def run(cmd, cwd):
    completed = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return completed.returncode, completed.stdout, completed.stderr


def find_cases(case_ids):
    case_dirs = sorted(path for path in CASES_ROOT.iterdir() if path.is_dir())
    if case_ids:
        wanted = set(case_ids)
        case_dirs = [path for path in case_dirs if path.name in wanted]
    return case_dirs


def aggregate(results):
    ok = [item for item in results if item["status"] == "ok"]
    if not ok:
        return {
            "case_count": len(results),
            "ok_count": 0,
            "avg_score": 0.0,
            "avg_record_recall": 0.0,
            "avg_artifact_recall": 0.0,
            "avg_reference_recall": 0.0,
            "total_missing_records": 0,
            "total_missing_artifacts": 0,
            "total_missing_reference_pairs": 0
        }
    return {
        "case_count": len(results),
        "ok_count": len(ok),
        "avg_score": round(sum(item["score"] for item in ok) / len(ok), 4),
        "avg_record_recall": round(sum(item["record_recall"] for item in ok) / len(ok), 4),
        "avg_artifact_recall": round(sum(item["artifact_recall"] for item in ok) / len(ok), 4),
        "avg_reference_recall": round(sum(item["reference_recall"] for item in ok) / len(ok), 4),
        "total_missing_records": sum(len(item["missing_records"]) for item in ok),
        "total_missing_artifacts": sum(len(item["missing_artifacts"]) for item in ok),
        "total_missing_reference_pairs": sum(len(item["missing_reference_pairs"]) for item in ok)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3.5:9b")
    parser.add_argument("--think", default="false")
    parser.add_argument("--stream", action="store_true")
    parser.add_argument("--run-label", required=True)
    parser.add_argument("--cases", default="")
    parser.add_argument("--ollama-timeout-sec", type=int, default=120)
    parser.add_argument("--drop-overbroad-encounters", type=int, default=1)
    parser.add_argument("--strict-object-head-matching", type=int, default=1)
    parser.add_argument("--drop-ambiguous-no-overlap", type=int, default=1)
    parser.add_argument("--drop-weak-no-overlap", type=int, default=1)
    parser.add_argument("--support-min-tokens", type=int, default=3)
    parser.add_argument("--fanout-main", type=int, default=3)
    parser.add_argument("--fanout-minor", type=int, default=2)
    parser.add_argument("--weak-label-penalty", type=int, default=18)
    args = parser.parse_args()

    case_ids = [item.strip() for item in args.cases.split(",") if item.strip()]
    case_dirs = find_cases(case_ids)
    run_root = ROOT / "benchmark-runs" / args.run_label
    run_root.mkdir(parents=True, exist_ok=True)

    results = []
    for case_dir in case_dirs:
        output_dir = run_root / case_dir.name
        cmd = [
            sys.executable,
            str(ROOT / "run_superpipeline_1_2_3.py"),
            "--model",
            args.model,
            "--think",
            args.think,
            "--output-dir",
            str(output_dir.relative_to(ROOT)),
            "--entry-file",
            str(case_dir / "entry.txt"),
            "--ollama-timeout-sec",
            str(args.ollama_timeout_sec),
            "--drop-overbroad-encounters",
            str(args.drop_overbroad_encounters),
            "--strict-object-head-matching",
            str(args.strict_object_head_matching),
            "--drop-ambiguous-no-overlap",
            str(args.drop_ambiguous_no_overlap),
            "--drop-weak-no-overlap",
            str(args.drop_weak_no_overlap),
            "--support-min-tokens",
            str(args.support_min_tokens),
            "--fanout-main",
            str(args.fanout_main),
            "--fanout-minor",
            str(args.fanout_minor),
            "--weak-label-penalty",
            str(args.weak_label_penalty)
        ]
        if args.stream:
            cmd.append("--stream")

        print(f"[case {case_dir.name}] running...", flush=True)
        code, stdout, stderr = run(cmd, ROOT)
        result = {
            "case_id": case_dir.name,
            "output_dir": str(output_dir),
            "runner_exit_code": code
        }
        if code != 0:
            result["status"] = "runner_failed"
            result["stderr"] = stderr[-4000:]
            results.append(result)
            continue

        eval_cmd = [
            sys.executable,
            str(ROOT / "superpipeline_case_eval.py"),
            str(output_dir),
            str(case_dir / "expectations.json")
        ]
        eval_code, eval_stdout, eval_stderr = run(eval_cmd, ROOT)
        if eval_code != 0:
            result["status"] = "eval_failed"
            result["stderr"] = eval_stderr[-4000:]
            results.append(result)
            continue

        result["status"] = "ok"
        result.update(json.loads(eval_stdout))
        results.append(result)
        print(
            f"[case {case_dir.name}] score={result['score']} r={result['record_recall']} a={result['artifact_recall']} ref={result['reference_recall']}",
            flush=True,
        )

    summary = {
        "run_label": args.run_label,
        "model": args.model,
        "aggregate": aggregate(results),
        "results": results
    }
    (run_root / "benchmark-summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = ["# Superpipeline Benchmark Summary", ""]
    lines.append(f"- run label: `{args.run_label}`")
    lines.append(f"- model: `{args.model}`")
    lines.append(f"- avg score: `{summary['aggregate']['avg_score']}`")
    lines.append(f"- avg record recall: `{summary['aggregate']['avg_record_recall']}`")
    lines.append(f"- avg artifact recall: `{summary['aggregate']['avg_artifact_recall']}`")
    lines.append(f"- avg reference recall: `{summary['aggregate']['avg_reference_recall']}`")
    lines.append("")
    for item in results:
        if item["status"] == "ok":
            lines.append(
                f"- case `{item['case_id']}`: score `{item['score']}`, records `{item['record_recall']}`, artifacts `{item['artifact_recall']}`, refs `{item['reference_recall']}`, missing records `{len(item['missing_records'])}`, missing artifacts `{len(item['missing_artifacts'])}`, missing refs `{len(item['missing_reference_pairs'])}`"
            )
        else:
            lines.append(f"- case `{item['case_id']}`: `{item['status']}`")
    (run_root / "benchmark-summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
