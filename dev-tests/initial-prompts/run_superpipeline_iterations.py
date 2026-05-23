#!/usr/bin/env python3

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


ITERATIONS = [
    {"iteration": 6, "label": "strict_baseline", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 7, "label": "tighter_fanout", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "2", "--fanout-minor", "1", "--weak-label-penalty", "18"]},
    {"iteration": 8, "label": "higher_support_floor", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "3", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 9, "label": "stronger_weak_penalty", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "26"]},
    {"iteration": 10, "label": "relaxed_head_matching", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "0", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 11, "label": "keep_ambiguous", "reuse_raw_from": "outputs-superpipeline-qwen3_5-9b-iter8", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "0", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 12, "label": "keep_overbroad_encounters", "reuse_raw_from": "outputs-superpipeline-qwen3_5-9b-iter8", "args": ["--drop-overbroad-encounters", "0", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 13, "label": "looser_weak_filter", "reuse_raw_from": "outputs-superpipeline-qwen3_5-9b-iter8", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "0", "--support-min-tokens", "2", "--fanout-main", "3", "--fanout-minor", "2", "--weak-label-penalty", "18"]},
    {"iteration": 14, "label": "balanced_tight", "reuse_raw_from": "outputs-superpipeline-qwen3_5-9b-iter8", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "2", "--fanout-minor", "2", "--weak-label-penalty", "24"]},
    {"iteration": 15, "label": "balanced_looser", "reuse_raw_from": "outputs-superpipeline-qwen3_5-9b-iter8", "args": ["--drop-overbroad-encounters", "1", "--strict-object-head-matching", "1", "--drop-ambiguous-no-overlap", "1", "--drop-weak-no-overlap", "1", "--support-min-tokens", "2", "--fanout-main", "4", "--fanout-minor", "2", "--weak-label-penalty", "20"]},
]


def run(cmd):
    completed = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    return completed.returncode, completed.stdout, completed.stderr


def main():
    model = "qwen3.5:9b"
    spec_path = ROOT / "benchmark-cases" / "maximal_realistic_stress" / "expectations.json"
    results = []

    for item in ITERATIONS:
        iteration = item["iteration"]
        output_dir = ROOT / f"outputs-superpipeline-qwen3_5-9b-iter{iteration}"
        cmd = [
            sys.executable,
            str(ROOT / "run_superpipeline_1_2_3.py"),
            "--model",
            model,
            "--think",
            "false",
            "--output-dir",
            output_dir.name,
            *item["args"],
        ]
        if item.get("reuse_raw_from"):
            cmd.extend(["--reuse-raw-from", str(ROOT / item["reuse_raw_from"])])
        print(f"[iter {iteration}] running {item['label']}...", flush=True)
        code, stdout, stderr = run(cmd)
        run_record = {
            "iteration": iteration,
            "label": item["label"],
            "output_dir": output_dir.name,
            "runner_exit_code": code,
        }
        if code != 0:
            run_record["status"] = "runner_failed"
            run_record["stderr"] = stderr[-4000:]
            results.append(run_record)
            continue

        eval_cmd = [sys.executable, str(ROOT / "superpipeline_eval.py"), str(output_dir), str(spec_path)]
        eval_code, eval_stdout, eval_stderr = run(eval_cmd)
        if eval_code != 0:
            run_record["status"] = "eval_failed"
            run_record["stderr"] = eval_stderr[-4000:]
            results.append(run_record)
            continue

        run_record["status"] = "ok"
        run_record.update(json.loads(eval_stdout))
        results.append(run_record)
        print(f"[iter {iteration}] score={run_record['score']} refs={run_record['phase_2_references']}", flush=True)

    results_path = ROOT / "superpipeline-iteration-results.json"
    results_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = ["# Superpipeline Iteration Results", ""]
    for item in results:
        if item["status"] == "ok":
            lines.append(f"- iter {item['iteration']} `{item['label']}`: score `{item['score']}`, records `{item['phase_1_records']}`, artifacts `{item['phase_1_artifacts']}`, refs `{item['phase_2_references']}`, record recall `{item['record_recall']}`, artifact recall `{item['artifact_recall']}`, ref recall `{item['reference_recall']}`")
        else:
            lines.append(f"- iter {item['iteration']} `{item['label']}`: `{item['status']}`")
    (ROOT / "superpipeline-iteration-results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    best = [item for item in results if item["status"] == "ok"]
    if best:
        best_item = max(best, key=lambda item: item["score"])
        print(json.dumps({"best_iteration": best_item["iteration"], "label": best_item["label"], "score": best_item["score"], "output_dir": best_item["output_dir"]}, indent=2, ensure_ascii=False))
    else:
        print(json.dumps({"best_iteration": None}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
