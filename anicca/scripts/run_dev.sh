#!/usr/bin/env bash
set -euo pipefail

# activate your conda env in the shell before running this (example):
# conda activate anicca-env

# run dev server on localhost with auto-reload
python -m uvicorn anicca.main:app --host 127.0.0.1 --port 8000 --reload

