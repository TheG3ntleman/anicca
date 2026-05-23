#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

from superpipeline_case_eval import evaluate_case


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    parser.add_argument("spec_path")
    args = parser.parse_args()
    result = evaluate_case(Path(args.output_dir), Path(args.spec_path))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
