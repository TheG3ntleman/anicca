# Initial Prompt Harness

This folder freezes the current phase-2, phase-3, and phase-4 prompts into a small local test harness.

Contents:

- `phase-2-prompt.txt`: current phase-2 extraction prompt
- `phase-3-prompt.txt`: current phase-3 reference-extraction prompt
- `phase-4-prompt.txt`: current phase-4 culling/consolidation prompt
- `large-difficult-entry.txt`: the large adversarial journal entry
- `run_ollama_pipeline.py`: sequential runner for phase 2 -> phase 3 -> phase 4 using Ollama
- `outputs/`: raw prompts, raw model responses, and parsed JSON outputs

Default model target:

- `qwen3:4b`

Example usage:

```bash
python3 dev-tests/initial-prompts/run_ollama_pipeline.py
python3 dev-tests/initial-prompts/run_ollama_pipeline.py --model qwen3:4b
python3 dev-tests/initial-prompts/run_ollama_pipeline.py --model qwen3:4b --think low --stream
python3 dev-tests/initial-prompts/run_ollama_pipeline.py --model qwen3.5:4b --think low --stream --output-dir outputs-qwen3_5-4b
```

Notes:

- The runner saves the exact prompts sent to the model.
- It also saves raw model text before JSON extraction.
- Parsed JSON is extracted by taking the outermost JSON object from the model response.
- The runner calls Ollama with `--format json`.
- Thinking mode is configurable with `--think false|low|medium|high`.
- Live terminal streaming is available with `--stream`.
- Output files can be separated per experiment with `--output-dir`.
- The runner validates stage-specific top-level keys so a phase cannot silently pass with the wrong schema.
