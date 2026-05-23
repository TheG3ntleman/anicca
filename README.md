# Anicca

Anicca is a standalone Python application for capturing entries and building insight from
them over time.

## Development setup

Create or activate your environment, then install the project in editable mode:

```bash
pip install -e ".[dev]"
```

Run the local app with:

```bash
anicca
```

Or:

```bash
uvicorn anicca.main:app --reload
```
