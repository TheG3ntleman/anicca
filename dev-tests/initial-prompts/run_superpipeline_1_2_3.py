#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path

from run_ollama_pipeline import (
    BEHAVIOUR_RE,
    BODY_RE,
    OTHER_PEOPLE_SPEECH_RE,
    ROOT,
    THOUGHT_RE,
    build_phase4_passthrough,
    canonical_event_text,
    clean_phase2,
    clean_phase3,
    ensure_outputs,
    extract_json,
    is_noninformative_record_anchor,
    normalize_space,
    repair_span,
    read_text,
    run_ollama,
    save,
)

DISCOURSE_MARKER_RE = re.compile(
    r"\s+(?=(?:Yesterday(?: morning| evening)?|During\b|After(?:ward)?\b|At\b|Before\b|On\b|Later\b|Then\b))"
)

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "it",
    "i",
    "my",
    "me",
    "was",
    "were",
    "is",
    "are",
    "in",
    "on",
    "at",
    "for",
    "with",
    "that",
    "this",
    "again",
}
PRONOUN_RE = re.compile(r"\b(it|them|she|he|him|her)\b", re.I)
CLAUSE_HEAD_RE = re.compile(
    r"(?:I\b|my\b|printed\b|copied\b|read\b|opened\b|deleted\b|restored\b|wrote\b|rewrote\b|compared\b|kept\b|still\b|if\b|did\s+not\b|didn't\b|couldn't\b|wanted\b|listened\b|told\b|admitted\b|apologized\b|crossed\b|erased\b|reopened\b|underlined\b|circled\b|added\b|stared\b|put\b)",
    re.I,
)

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

CONFIG = {
    "drop_overbroad_encounters": True,
    "strict_object_head_matching": True,
    "drop_ambiguous_no_overlap": True,
    "drop_weak_no_overlap": True,
    "support_min_tokens": 2,
    "fanout_main": 3,
    "fanout_minor": 2,
    "weak_label_penalty": 18,
    "reindex_phase1_after_prune": True,
}

GENERIC_RECORD_REGEXES = [
    ("thought", re.compile(r"\bI keep telling myself\b[^,.;]*", re.I)),
    ("thought", re.compile(r"\bkept telling myself\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI don't believe\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI kept wondering\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI still think\b[^,.;]*", re.I)),
    ("thought", re.compile(r"\bI still didn't know\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI spent the afternoon thinking\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI don't care\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI care that\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI still can't tell\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI don't know\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bstill didn't know\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bPart of me wants\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bPart of me wanted\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bpart of me wanted\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bpart of me only wants\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI keep insisting\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI keep reading\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bkept hearing\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bI couldn't tell\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bcouldn't tell\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bIf I call back\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bif I don't\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bMost of today was me arguing\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bMost of the afternoon was me arguing\b[^.;]*", re.I)),
    ("thought", re.compile(r"\bThe rest of the evening was me arguing\b[^.;]*", re.I)),
    ("emotion", re.compile(r"\bI am not angry\b[^.;]*", re.I)),
    ("emotion", re.compile(r"\bI wasn't calm\b[^.;]*", re.I)),
    ("emotion", re.compile(r"\bI wasn't\b[^.;]*", re.I)),
    ("emotion", re.compile(r"\bI felt [^.;]*", re.I)),
    ("emotion", re.compile(r"\bI missed [A-Z][a-z]+\b", re.I)),
    ("emotion", re.compile(r"\bWhat I actually feel\b[^.;]*", re.I)),
    ("emotion", re.compile(r"\bstood there feeling stupid\b", re.I)),
    ("emotion", re.compile(r"\bI am tired\b[^.;]*", re.I)),
    ("body", re.compile(r"\bmy [A-Za-z']+ was [A-Za-z']+\b[^.;,]*", re.I)),
    ("body", re.compile(r"\bmy [A-Za-z']+ tightened\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\bI reread\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bI read\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bread it again\b", re.I)),
    ("behaviour", re.compile(r"\bprinted\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\bcopied\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\bI admitted\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI apologized\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bapologized\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bI opened\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bopened\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\bdeleted one sentence\b", re.I)),
    ("behaviour", re.compile(r"\bdeleted one paragraph\b", re.I)),
    ("behaviour", re.compile(r"\bdeleted the message instead of sending it\b", re.I)),
    ("behaviour", re.compile(r"\bI deleted\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\brestored it\b", re.I)),
    ("behaviour", re.compile(r"\bI wrote\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bI wrote \"[^\"]+\" on the whiteboard\b", re.I)),
    ("behaviour", re.compile(r"\bI wrote \"[^\"]+\" in the margin\b", re.I)),
    ("behaviour", re.compile(r"\bwrote \"[^\"]+\"[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bcrossed it out\b", re.I)),
    ("behaviour", re.compile(r"\bcrossed them out\b", re.I)),
    ("behaviour", re.compile(r"\brewrote the last line\b", re.I)),
    ("behaviour", re.compile(r"\bI compared\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bcompared\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bcircled\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\badded a note\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI said\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI told\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI reopened\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI texted\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bI underlined\b[^,.;]*", re.I)),
    ("behaviour", re.compile(r"\bstared at the throughput table\b", re.I)),
    ("behaviour", re.compile(r"\bstared at\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bI listened to the voicemail from Dr\. [A-Z][a-z]+\b", re.I)),
    ("behaviour", re.compile(r"\bI listened to\b[^.;]*", re.I)),
    ("behaviour", re.compile(r"\bdid not call back\b", re.I)),
    ("behaviour", re.compile(r"\bdidn't send\b[^.;,]*", re.I)),
    ("behaviour", re.compile(r"\berased it\b", re.I)),
    ("behaviour", re.compile(r"\berased that too\b", re.I)),
    ("thought", re.compile(r"\bI don't\b(?!\s+[A-Za-z])", re.I)),
    ("thought", re.compile(r"\bI did not decide to quit\b", re.I)),
    ("thought", re.compile(r"\bI did not forgive [A-Z][a-z]+\b", re.I)),
]

GENERIC_OBJECT_REGEXES = [
    re.compile(r"\b[A-Z][a-z]+'s email\b"),
    re.compile(r"\b[A-Z][a-z]+'s email about [A-Za-z']+(?: [A-Za-z']+){0,3}\b"),
    re.compile(r"\b[A-Z][a-z]+'s message\b"),
    re.compile(r"\b[A-Z][a-z]+'s note\b"),
    re.compile(r"\breply to [A-Z][a-z]+\b", re.I),
    re.compile(r"\bdraft reply to [A-Z][a-z]+\b", re.I),
    re.compile(r"\bunsent reply to [A-Z][a-z]+\b", re.I),
    re.compile(r"\bemail to [A-Z][a-z]+\b", re.I),
    re.compile(r"\b(?:calendar|meeting|follow-up) invite\b", re.I),
    re.compile(r"\bnote about [A-Za-z']+(?: [A-Za-z']+){0,3}(?=\s+again\b|[.,;]|$)", re.I),
    re.compile(r"\bnotebook\b", re.I),
    re.compile(r"\blast line\b", re.I),
    re.compile(r"\bessay by [A-Z][a-z]+\b"),
    re.compile(r"\bscene in the (?:essay|novel|story) where [^.;]+"),
    re.compile(r"\bsentence about [A-Za-z']+(?: [A-Za-z']+){0,2}(?=\s+as\b|[.,;]|$)", re.I),
    re.compile(r"\b(?:my own )?(?:design |project |correction )?(?:memo|roadmap)\b", re.I),
    re.compile(r"\b(?:audit|billing|ethics|safety|appeal|incident) (?:appeal|complaint|review|log)\b", re.I),
    re.compile(r"\b(?:draft|revised|corrected|unsent|follow-up)? ?(?:invoice|report|spreadsheet|budget|trace|graph|table|window|paragraph|sentence|line|row|log|note|message|reply|memo)\b", re.I),
    re.compile(r"\b(?:my own |my |last(?: night's)? |yesterday's |today's )?(?:[A-Za-z']+ )?(?:memo|roadmap|log|table|trace|graph|window|report|reply|email|message|note|draft|assumptions)\b", re.I),
    re.compile(r"\b(?:clinic|vendor|contractor|customer|client|partner|office|team|board|committee|hospital|school)\b", re.I),
    re.compile(r"\b(?:cache|queue|parser|schema|index|query|config|state|worker|router|server|client|database|auth(?:entication)?|assumptions|throughput|latency)\b", re.I),
    re.compile(r"\bspike near [A-Za-z']+(?: [A-Za-z']+){0,2}\b", re.I),
    re.compile(r"\bdraft reply to [A-Z][a-z]+\b", re.I),
    re.compile(r"\bthe [A-Z]{2,}\b"),
    re.compile(r"\bthe (?:novel|story|essay|message|margin|brother|cache|queue|parser|schema|index|database)\b", re.I),
    re.compile(r"\bwhiteboard\b", re.I),
    re.compile(r"\bvoicemail from Dr\. [A-Z][a-z]+\b"),
    re.compile(r"\bmy brother\b", re.I),
    re.compile(r"\bmy brother [A-Z][a-z]+\b", re.I),
    re.compile(r"\bscan\b", re.I),
    re.compile(r"\bone sentence\b", re.I),
    re.compile(r"\bone paragraph\b", re.I),
]

GENERIC_ENCOUNTER_REGEXES = [
    re.compile(r"\bmeeting with [A-Z][a-z]+(?:, (?:our|my) [A-Za-z ]+)?\b"),
    re.compile(r"\bcall with [A-Z][a-z]+(?:, the [A-Za-z]+)?\b"),
    re.compile(r"\bcode review with [A-Z][a-z]+\b"),
    re.compile(r"\bsite visit\b", re.I),
    re.compile(r"\b(?:client|customer|vendor) (?:demo|walkthrough|review)\b", re.I),
    re.compile(r"\b[A-Za-z']+(?:'s)? [A-Za-z']+ interview\b", re.I),
    re.compile(r"\bdinner with [^.;,]+\b", re.I),
]

GENERIC_NAME_PATTERNS = [
    re.compile(r"\bwith (Dr\. [A-Z][a-z]+|[A-Z][a-z]+)\b"),
    re.compile(r"\bto (Dr\. [A-Z][a-z]+|[A-Z][a-z]+)\b"),
    re.compile(r"\bfrom (Dr\. [A-Z][a-z]+|[A-Z][a-z]+)\b"),
    re.compile(r"\bby ([A-Z][a-z]+)\b"),
    re.compile(r"\bmiss(?:ed)? ([A-Z][a-z]+)\b", re.I),
    re.compile(r"\bangry at ([A-Z][a-z]+)\b", re.I),
    re.compile(r"\btexted ([A-Z][a-z]+)\b", re.I),
    re.compile(r"\bforgive ([A-Z][a-z]+)\b", re.I),
    re.compile(r"\bfor ([A-Z][a-z]+), for ([A-Z][a-z]+)\b"),
    re.compile(r"\bfor ([A-Z][a-z]+)\b"),
    re.compile(r"\bmy brother ([A-Z][a-z]+)\b"),
]

CARRIER_FAMILIES = {
    "message": {"message", "email", "thread", "reply", "draft", "note", "voicemail"},
    "document": {"report", "memo", "table", "trace", "spreadsheet", "invite", "line", "paragraph", "sentence", "page", "margin"},
    "medical": {"scan"},
    "literary": {"novel", "scene", "chapter"},
}


def coerce_uncertainties(values):
    results = []
    seen = set()
    for value in values or []:
        if isinstance(value, str):
            text = normalize_space(value)
        elif isinstance(value, dict):
            text = normalize_space(str(value.get("text", "")))
        else:
            text = normalize_space(str(value))
        if text and text not in seen:
            seen.add(text)
            results.append(text)
    return results


def normalize_records_payload(payload):
    if isinstance(payload, dict) and "candidate_records" not in payload and "process_type" in payload and "source_text" in payload:
        payload = {"candidate_records": [payload], "uncertainties": []}
    records = []
    for item in payload.get("candidate_records", []):
        if not isinstance(item, dict):
            continue
        source_text = item.get("source_text")
        if not isinstance(source_text, str):
            continue
        records.append(
            {
                "process_type": str(item.get("process_type", "thought")),
                "source_text": normalize_space(source_text),
                "notes": normalize_space(str(item.get("notes", ""))),
            }
        )
    return {"candidate_records": records, "uncertainties": coerce_uncertainties(payload.get("uncertainties", []))}


def normalize_encounters_payload(payload):
    if isinstance(payload, dict) and "candidate_artifacts" not in payload and payload.get("artifact_kind") == "encounter":
        payload = {"candidate_artifacts": [payload], "uncertainties": []}
    artifacts = []
    for item in payload.get("candidate_artifacts", []):
        if not isinstance(item, dict):
            continue
        texts = item.get("source_texts", [])
        if not isinstance(texts, list):
            continue
        cleaned_texts = [normalize_space(str(text)) for text in texts if normalize_space(str(text))]
        if not cleaned_texts:
            continue
        artifacts.append(
            {
                "artifact_kind": "encounter",
                "source_texts": cleaned_texts,
                "notes": normalize_space(str(item.get("notes", ""))),
            }
        )
    return {"candidate_artifacts": artifacts, "uncertainties": coerce_uncertainties(payload.get("uncertainties", []))}


def normalize_objects_payload(payload):
    if isinstance(payload, dict) and "candidate_artifacts" not in payload and payload.get("artifact_kind") == "object":
        payload = {"candidate_artifacts": [payload], "uncertainties": []}
    artifacts = []
    for item in payload.get("candidate_artifacts", []):
        if not isinstance(item, dict):
            continue
        source_text = item.get("source_text")
        if not isinstance(source_text, str):
            continue
        artifacts.append(
            {
                "artifact_kind": "object",
                "source_text": normalize_space(source_text),
                "notes": normalize_space(str(item.get("notes", ""))),
            }
        )
    return {"candidate_artifacts": artifacts, "uncertainties": coerce_uncertainties(payload.get("uncertainties", []))}


def normalize_record_links_payload(payload):
    if isinstance(payload, dict) and "candidate_references" not in payload and "from_candidate_id" in payload and "to_candidate_id" in payload:
        payload = {"candidate_references": [payload], "uncertainties": []}
    refs = []
    for item in payload.get("candidate_references", []):
        if not isinstance(item, dict):
            continue
        if not item.get("from_candidate_id") or not item.get("to_candidate_id"):
            continue
        refs.append(
            {
                "from_candidate_id": str(item.get("from_candidate_id", "")),
                "to_candidate_id": str(item.get("to_candidate_id", "")),
                "relation_label": normalize_space(str(item.get("relation_label", ""))),
                "relation_status": str(item.get("relation_status", "ambiguous")),
                "supporting_text": normalize_space(str(item.get("supporting_text", ""))),
                "notes": normalize_space(str(item.get("notes", ""))),
            }
        )
    return {"candidate_references": refs, "uncertainties": coerce_uncertainties(payload.get("uncertainties", []))}


def build_tagged_request(prompt, blocks):
    parts = [prompt, ""]
    for tag, text in blocks:
        parts.append(f"<{tag}>\n{text}\n</{tag}>")
        parts.append("")
    parts.append("Return only the final JSON object.")
    return "\n".join(parts)


def split_on_discourse_markers(entry):
    rewritten = DISCOURSE_MARKER_RE.sub("\n", entry)
    return [normalize_space(block) for block in rewritten.splitlines() if normalize_space(block)]


def split_sentences(entry):
    protected = re.sub(r"\bDr\. (?=[A-Z])", "Dr§ ", entry)
    protected = re.sub(r'([.!?]["\']?)\s+(?=[A-Z])', r"\1\n", protected)
    parts = protected.splitlines()
    sentences = [part.replace("Dr§ ", "Dr. ").strip() for part in parts if part.strip()]
    return sentences or [entry]


def split_sentence_into_clauses(sentence):
    text = sentence.strip()
    if not text:
        return []

    protected = text.replace("Dr. ", "Dr§ ")
    separators = [", then ", " and then ", ", and ", " and ", ", but ", " but ", ", ", "; ", ": "]
    clauses = []
    start = 0
    idx = 0
    in_quote = False
    while idx < len(protected):
        if protected[idx] == '"':
            in_quote = not in_quote
            idx += 1
            continue
        if not in_quote:
            matched_sep = None
            for sep in separators:
                if protected.startswith(sep, idx):
                    tail = protected[idx + len(sep) :]
                    if CLAUSE_HEAD_RE.match(tail):
                        matched_sep = sep
                        break
            if matched_sep is not None:
                chunk = protected[start:idx].strip(" ,;:")
                if chunk:
                    clauses.append(chunk.replace("Dr§ ", "Dr. "))
                start = idx + len(matched_sep)
                idx = start
                continue
        idx += 1

    tail = protected[start:].strip(" ,;:")
    if tail:
        clauses.append(tail.replace("Dr§ ", "Dr. "))

    cleaned = [normalize_space(clause) for clause in clauses if normalize_space(clause)]
    return cleaned or [text]


def classify_work_unit_kind(unit_text):
    lowered = unit_text.lower()
    action_hits = sum(1 for token in ["reread", "printed", "admitted", "apologized", "put", "opened", "stared", "told", "read", "deleted", "restored"] if token in lowered)
    reflective_hits = sum(1 for token in ["wondering", "wanted", "knew", "don't know", "couldn't tell", "kept hearing", "afraid"] if token in lowered)
    episodic_hits = sum(1 for token in ["train", "meeting", "dinner", "call", "interview", "walkthrough", "visit", "appointment", "procedure", "laughed"] if token in lowered)
    if reflective_hits and episodic_hits:
        return "mixed"
    if reflective_hits and not action_hits:
        return "reflective"
    if action_hits and reflective_hits:
        return "mixed"
    if episodic_hits or action_hits:
        return "narrative"
    return "fragmentary"


def should_merge_with_previous_unit(previous_text, current_text, current_kind):
    if not previous_text:
        return False
    current = current_text.strip()
    if not current:
        return False
    if current[:1].islower():
        return True
    if current_kind == "fragmentary" and len(current.split()) <= 4:
        return True
    if re.match(r"^(my manager|our legal lead|my supervisor|my brother [A-Z][a-z]+|my brother)\b", current):
        return True
    return False


def should_use_model_for_records(unit_text, unit_kind, deterministic_payload):
    if not deterministic_payload.get("candidate_records"):
        return True
    lowered = unit_text.lower()
    if unit_kind in {"mixed", "reflective"}:
        return True
    if re.search(r"\b(admitted|told|felt|missed|part of me wanted|if i call back|i don't\b)\b", lowered):
        return True
    if "whether" in lowered and any(token in lowered for token in {"admitted", "told", "wanted", "felt", "jaw tightened"}):
        return True
    if any(token in lowered for token in {"but i wasn't", "all at once", "could barely swallow"}):
        return True
    return False


def segment_local_work_units(entry):
    raw_units = []
    for block in split_on_discourse_markers(entry):
        for sentence in split_sentences(block):
            for clause in split_sentence_into_clauses(sentence):
                raw_units.append(
                    {
                        "unit_text": clause,
                        "unit_kind": classify_work_unit_kind(clause),
                    }
                )

    merged = []
    for unit in raw_units:
        if merged and should_merge_with_previous_unit(merged[-1]["unit_text"], unit["unit_text"], unit["unit_kind"]):
            separator = ", " if not merged[-1]["unit_text"].endswith((".", "?", "!", '"')) else " "
            merged[-1]["unit_text"] = normalize_space(f"{merged[-1]['unit_text']}{separator}{unit['unit_text']}")
            merged[-1]["unit_kind"] = classify_work_unit_kind(merged[-1]["unit_text"])
        else:
            merged.append(dict(unit))

    units = []
    for idx, unit in enumerate(merged, start=1):
        units.append(
            {
                "unit_id": f"unit-{idx}",
                "unit_text": unit["unit_text"],
                "unit_kind": unit["unit_kind"],
            }
        )
    return units


def safe_run_substep(model, think, stream, stage_name, prompt, blocks, normalizer, outputs_dir, stem, timeout_sec=None):
    request = build_tagged_request(prompt, blocks)
    save(outputs_dir, f"{stem}-request.txt", request)
    try:
        raw = run_ollama(model, request, think, stream, stage_name, timeout_sec=timeout_sec)
        save(outputs_dir, f"{stem}-raw.txt", raw)
        payload = normalizer(extract_json(raw))
        save(outputs_dir, f"{stem}.json", json.dumps(payload, indent=2, ensure_ascii=False))
        return payload, None
    except Exception as exc:
        error_text = str(exc)
        save(outputs_dir, f"{stem}-error.txt", error_text)
        empty = normalizer({})
        save(outputs_dir, f"{stem}.json", json.dumps(empty, indent=2, ensure_ascii=False))
        return empty, error_text


def merge_records_payloads(*payloads):
    merged = {}
    uncertainties = []
    seen_unc = set()
    for payload in payloads:
        for item in payload.get("candidate_records", []):
            source_text = normalize_space(item.get("source_text", ""))
            if not source_text:
                continue
            merged[source_text.lower()] = {
                "process_type": str(item.get("process_type", "thought")),
                "source_text": source_text,
                "notes": normalize_space(str(item.get("notes", ""))),
            }
        for text in payload.get("uncertainties", []):
            clean = normalize_space(str(text))
            if clean and clean not in seen_unc:
                seen_unc.add(clean)
                uncertainties.append(clean)
    return {"candidate_records": list(merged.values()), "uncertainties": uncertainties}


def merge_artifact_payloads(*payloads):
    merged = {}
    uncertainties = []
    seen_unc = set()
    for payload in payloads:
        for item in payload.get("candidate_artifacts", []):
            if item.get("artifact_kind") == "object":
                source_text = normalize_space(item.get("source_text", ""))
                if not source_text:
                    continue
                key = ("object", source_text.lower())
                merged[key] = {"artifact_kind": "object", "source_text": source_text, "notes": normalize_space(str(item.get("notes", "")))}
            elif item.get("artifact_kind") == "encounter":
                source_texts = [normalize_space(str(text)) for text in item.get("source_texts", []) if normalize_space(str(text))]
                if not source_texts:
                    continue
                key = ("encounter", tuple(text.lower() for text in source_texts))
                merged[key] = {"artifact_kind": "encounter", "source_texts": source_texts, "notes": normalize_space(str(item.get("notes", "")))}
        for text in payload.get("uncertainties", []):
            clean = normalize_space(str(text))
            if clean and clean not in seen_unc:
                seen_unc.add(clean)
                uncertainties.append(clean)
    return {"candidate_artifacts": list(merged.values()), "uncertainties": uncertainties}


def merge_reference_payloads(*payloads):
    merged = {}
    uncertainties = []
    seen_unc = set()
    for payload in payloads:
        for item in payload.get("candidate_references", []):
            from_id = str(item.get("from_candidate_id", ""))
            to_id = str(item.get("to_candidate_id", ""))
            support = normalize_space(str(item.get("supporting_text", "")))
            if not from_id or not to_id or not support:
                continue
            key = (from_id, to_id, support.lower())
            current = merged.get(key)
            candidate = {
                "from_candidate_id": from_id,
                "to_candidate_id": to_id,
                "relation_label": normalize_space(str(item.get("relation_label", ""))),
                "relation_status": str(item.get("relation_status", "ambiguous")),
                "supporting_text": support,
                "notes": normalize_space(str(item.get("notes", ""))),
            }
            if current is None or (current["relation_status"] == "ambiguous" and candidate["relation_status"] == "explicit"):
                merged[key] = candidate
        for text in payload.get("uncertainties", []):
            clean = normalize_space(str(text))
            if clean and clean not in seen_unc:
                seen_unc.add(clean)
                uncertainties.append(clean)
    return {"candidate_references": list(merged.values()), "uncertainties": uncertainties}


def assign_temp_ids_phase1(payload):
    records = []
    for idx, item in enumerate(payload.get("candidate_records", []), start=1):
        enriched = dict(item)
        enriched["candidate_id"] = f"tmp_r{idx}"
        records.append(enriched)
    artifacts = []
    for idx, item in enumerate(payload.get("candidate_artifacts", []), start=1):
        enriched = dict(item)
        enriched["candidate_id"] = f"tmp_a{idx}"
        artifacts.append(enriched)
    return {
        "candidate_records": records,
        "candidate_artifacts": artifacts,
        "uncertainties": coerce_uncertainties(payload.get("uncertainties", [])),
    }


def assign_temp_ids_phase2(payload):
    refs = []
    for idx, item in enumerate(payload.get("candidate_references", []), start=1):
        enriched = dict(item)
        enriched["candidate_reference_id"] = f"tmp_cr{idx}"
        refs.append(enriched)
    return {"candidate_references": refs, "uncertainties": coerce_uncertainties(payload.get("uncertainties", []))}


def deterministic_records_for_unit(unit_text):
    payload = {"candidate_records": [], "uncertainties": []}
    seen = set()
    matches = []
    for process_type, pattern in GENERIC_RECORD_REGEXES:
        for match in pattern.finditer(unit_text):
            source_text = normalize_space(match.group(0))
            if not source_text:
                continue
            matches.append((match.start(), process_type, source_text))
    matches.sort(key=lambda item: item[0])
    for _, process_type, source_text in matches:
        key = source_text.lower()
        if key in seen:
            continue
        seen.add(key)
        payload["candidate_records"].append({"process_type": process_type, "source_text": source_text, "notes": "generic deterministic fallback"})
        if re.search(r"\b(whether|don't know|couldn't tell|if i call back|if i don't)\b", source_text, re.I):
            payload["uncertainties"].append(source_text)
    return merge_records_payloads(payload)


def deterministic_encounters_for_unit(unit_text):
    payload = {"candidate_artifacts": [], "uncertainties": []}
    for pattern in GENERIC_ENCOUNTER_REGEXES:
        for match in pattern.finditer(unit_text):
            payload["candidate_artifacts"].append(
                {
                    "artifact_kind": "encounter",
                    "source_texts": [normalize_space(match.group(0))],
                    "notes": "generic deterministic fallback",
                }
            )
    return merge_artifact_payloads(payload)


def deterministic_objects_for_entry(entry):
    payload = {"candidate_artifacts": [], "uncertainties": []}
    seen = set()

    def add_object(text):
        clean = normalize_space(text)
        if not clean:
            return
        key = clean.lower()
        if key in seen:
            return
        seen.add(key)
        payload["candidate_artifacts"].append(
            {
                "artifact_kind": "object",
                "source_text": clean,
                "notes": "generic deterministic fallback",
            }
        )

    for pattern in GENERIC_OBJECT_REGEXES:
        for match in pattern.finditer(entry):
            add_object(match.group(0))

    for pattern in GENERIC_NAME_PATTERNS:
        for match in pattern.finditer(entry):
            groups = [group for group in match.groups() if group]
            if groups:
                for group in groups:
                    add_object(group)
            else:
                add_object(match.group(0))

    return merge_artifact_payloads(payload)


def compact_artifacts_for_record_linking(phase1):
    compact = []
    for item in phase1.get("candidate_artifacts", []):
        if item["artifact_kind"] == "object":
            compact.append(
                {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "object",
                    "source_text": item["source_text"],
                }
            )
        else:
            compact.append(
                {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "encounter",
                    "source_texts": item["source_texts"],
                }
            )
    return compact


def find_unit_for_text(units, text):
    for unit in units:
        if text and text in unit["unit_text"]:
            return unit
    return {"unit_id": "unit-unknown", "unit_text": "", "unit_kind": "fragmentary"}


def find_unit_index_for_text(units, text):
    for idx, unit in enumerate(units):
        if text and text in unit["unit_text"]:
            return idx
    return -1


def lexical_tokens(text):
    return {token for token in re.findall(r"[A-Za-z']+", text.lower()) if token and token not in STOPWORDS}


def artifact_text(artifact):
    return artifact["source_text"] if artifact["artifact_kind"] == "object" else artifact["source_texts"][0]


def content_tokens(text):
    return lexical_tokens(text)


def family_tokens(text):
    lowered = text.lower()
    families = set()
    for tokens in CARRIER_FAMILIES.values():
        if any(token in lowered for token in tokens):
            families.update(token for token in tokens if token in lowered)
    return families


def base_text_forms(text):
    lowered = text.lower()
    forms = {lowered}
    for prefix in ("the ", "a ", "an ", "my "):
        if lowered.startswith(prefix):
            forms.add(lowered[len(prefix) :])
    return {normalize_space(form) for form in forms if normalize_space(form)}


def build_record_context(record, units):
    unit_idx = find_unit_index_for_text(units, record["source_text"])
    record_unit = units[unit_idx] if unit_idx >= 0 else {"unit_id": "unit-unknown", "unit_text": "", "unit_kind": "fragmentary"}
    context_units = []
    if unit_idx >= 0:
        lookback = 0
        if PRONOUN_RE.search(record["source_text"]) or re.search(
            r"\b(reply|draft|message|note|scan|scene|it says|deleted|restored|rewrote|crossed|telling myself)\b",
            record["source_text"],
            re.I,
        ):
            lookback = 1
        if re.search(r"\b(knew what it said|it said|telling myself|did not call back|deleted|restored)\b", record["source_text"], re.I):
            lookback = max(lookback, 2)
        for back_idx in range(max(0, unit_idx - lookback), unit_idx):
            context_units.append(units[back_idx])
        context_units.append(record_unit)
        if unit_idx + 1 < len(units) and re.search(r"\bif I\b", record["source_text"], re.I):
            context_units.append(units[unit_idx + 1])
    else:
        context_units.append(record_unit)
    seen = set()
    ordered = []
    for unit in context_units:
        if unit["unit_id"] not in seen:
            seen.add(unit["unit_id"])
            ordered.append(unit)
    context_text = " ".join(unit["unit_text"] for unit in ordered if unit["unit_text"])
    return {
        "record_unit": record_unit,
        "unit_index": unit_idx,
        "context_units": ordered,
        "context_text": normalize_space(context_text),
    }


def is_short_pronominal_support(ref, record_text):
    support = ref["supporting_text"]
    support_tokens = content_tokens(support)
    return (
        ref["relation_status"] == "ambiguous"
        and support == record_text
        and len(support_tokens) < CONFIG["support_min_tokens"]
        and PRONOUN_RE.search(support) is not None
    )


def is_overbroad_encounter_span(text):
    lowered = text.lower()
    word_count = len(re.findall(r"\S+", text))
    has_author_process = (" i " in f" {lowered} " and (BEHAVIOUR_RE.search(text) or THOUGHT_RE.search(text) or BODY_RE.search(text)))
    has_other_people_clause = OTHER_PEOPLE_SPEECH_RE.search(text) is not None or re.search(r"\b(asked|said|told|laughed)\b", lowered) is not None
    return word_count >= 9 and (has_author_process or has_other_people_clause)


def reindex_phase1_output(phase1, entry):
    records = sorted(phase1.get("candidate_records", []), key=lambda item: entry.find(item["source_text"]))
    artifacts = sorted(
        phase1.get("candidate_artifacts", []),
        key=lambda item: entry.find(item["source_text"] if item["artifact_kind"] == "object" else item["source_texts"][0]),
    )
    for idx, item in enumerate(records, start=1):
        item["candidate_id"] = f"r{idx}"
    for idx, item in enumerate(artifacts, start=1):
        item["candidate_id"] = f"a{idx}"
    return {
        "candidate_records": records,
        "candidate_artifacts": artifacts,
        "uncertainties": coerce_uncertainties(phase1.get("uncertainties", [])),
    }


def prune_phase1_output(phase1, entry):
    kept_artifacts = []
    for artifact in phase1.get("candidate_artifacts", []):
        if CONFIG["drop_overbroad_encounters"] and artifact["artifact_kind"] == "encounter" and any(is_overbroad_encounter_span(text) for text in artifact.get("source_texts", [])):
            continue
        kept_artifacts.append(artifact)
    pruned = {
        "candidate_records": [dict(item) for item in phase1.get("candidate_records", [])],
        "candidate_artifacts": [dict(item) for item in kept_artifacts],
        "uncertainties": coerce_uncertainties(phase1.get("uncertainties", [])),
    }
    if CONFIG["reindex_phase1_after_prune"]:
        return reindex_phase1_output(pruned, entry)
    return pruned


def build_candidate_pairs_for_record(record, artifacts, units):
    record_text = normalize_space(record["source_text"])
    record_lower = record_text.lower()
    record_tokens = lexical_tokens(record_text)
    context = build_record_context(record, units)
    context_text = context["context_text"] or context["record_unit"]["unit_text"]
    context_lower = context_text.lower()
    has_pronoun = PRONOUN_RE.search(record_text) is not None

    ranked = []
    for artifact in artifacts:
        text = artifact_text(artifact)
        target_lower = text.lower()
        target_tokens = lexical_tokens(text)
        overlap = record_tokens & target_tokens
        score = 0
        reasons = []

        if target_lower in record_lower:
            score += 40
            reasons.append("direct_mention")
        else:
            for form in base_text_forms(text):
                if form and form in record_lower:
                    score += 30
                    reasons.append("direct_form")
                    break

        if text in context_text:
            score += 12
            reasons.append("local_context")

        if overlap:
            score += len(overlap) * 8
            reasons.append("token_overlap")

        shared_families = family_tokens(record_text) & family_tokens(text)
        if shared_families:
            score += 14
            reasons.append("carrier_family")

        if re.search(rf"\babout {re.escape(target_lower)}\b", record_lower):
            score += 18
            reasons.append("about_target")
        if re.search(rf"\bfor {re.escape(target_lower)}\b", record_lower):
            score += 18
            reasons.append("for_target")
        if re.search(rf"\bto {re.escape(target_lower)}\b", record_lower):
            score += 18
            reasons.append("to_target")
        if re.search(rf"\bat {re.escape(target_lower)}\b", record_lower):
            score += 16
            reasons.append("at_target")
        if re.search(rf"\bwith {re.escape(target_lower)}\b", record_lower):
            score += 14
            reasons.append("with_target")

        if artifact["artifact_kind"] == "encounter" and re.search(r"\b(during|during last week's|during last weeks|at|before|after|on|during the|before the|after the)\b", record_lower):
            if target_lower in context_lower or overlap:
                score += 18
                reasons.append("encounter_context")

        if has_pronoun and text in context_text:
            if re.search(r"\bthem\b", record_lower) and re.search(r"\bparents\b|\bpeople\b|\bteam\b", target_lower):
                score += 16
                reasons.append("plural_pronoun")
            elif re.search(r"\b(she|he|him|her)\b", record_lower) and re.search(r"\b[A-Z][a-z]+", text):
                score += 14
                reasons.append("person_pronoun")
            elif re.search(r"\bit\b", record_lower):
                score += 12
                reasons.append("object_pronoun")

        if re.search(r"\bwhether\b", record_lower) and text in context_text:
            if overlap or re.search(r"\b[A-Z][a-z]+", text):
                score += 12
                reasons.append("alternative_context")

        if re.search(r"\b(knew what it said|it said)\b", record_lower) and artifact["artifact_kind"] == "object":
            if any(token in target_lower for token in {"voicemail", "message", "note"}) and text in context_text:
                score += 18
                reasons.append("carrier_pronoun")

        if re.search(r"\bkept hearing\b|\bhearing\b|\bsay\b", record_lower) and re.search(r"\b[A-Z][a-z]+", text):
            if text in context_text or text in record_text:
                score += 20
                reasons.append("speaker_target")

        if re.search(r"\b(read|reread|opened|deleted|restored|wrote|rewrote|underlined|printed|compared|listened to)\b", record_lower):
            if artifact["artifact_kind"] == "object" and (overlap or shared_families or text in context_text):
                score += 10
                reasons.append("action_object")
        if re.search(r"\b(deleted|restored)\b", record_lower) and artifact["artifact_kind"] == "object":
            if any(token in target_lower for token in {"sentence", "paragraph", "draft", "reply"}) and text in context_text:
                score += 18
                reasons.append("edit_chain")

        if artifact["artifact_kind"] == "encounter" and is_overbroad_encounter_span(text):
            score -= 30

        if target_lower in {"me", "future", "freedom"} and not overlap and target_lower not in record_lower:
            score -= 10

        if score >= 10:
            ranked.append(
                {
                    "score": score,
                    "candidate_reason": ",".join(reasons),
                    "candidate_artifact": artifact,
                }
            )

    ranked.sort(key=lambda item: (-item["score"], item["candidate_artifact"]["candidate_id"]))
    pairs = []
    seen = set()
    for item in ranked:
        artifact = item["candidate_artifact"]
        artifact_id = artifact["candidate_id"]
        if artifact_id in seen:
            continue
        seen.add(artifact_id)
        pair = {
            "to_candidate_id": artifact_id,
            "artifact_kind": artifact["artifact_kind"],
            "artifact_text": artifact_text(artifact),
            "candidate_score": item["score"],
            "candidate_reason": item["candidate_reason"],
        }
        pairs.append(pair)
        if len(pairs) >= 8:
            break
    if not pairs:
        fallback = []
        for artifact in artifacts:
            text = artifact_text(artifact)
            if text in record_text or text in context_text or (lexical_tokens(text) & record_tokens):
                fallback.append(artifact)
        for artifact in fallback[:4]:
            pairs.append(
                {
                    "to_candidate_id": artifact["candidate_id"],
                    "artifact_kind": artifact["artifact_kind"],
                    "artifact_text": artifact_text(artifact),
                    "candidate_score": 1,
                    "candidate_reason": "fallback_overlap",
                }
            )
    return context, pairs


def infer_relation_label(record_text):
    lowered = record_text.lower()
    if "reread" in lowered or re.search(r"\bread\b", lowered):
        return "read"
    if "printed" in lowered:
        return "printed"
    if "apologized" in lowered:
        return "about"
    if "wrote" in lowered:
        return "wrote on" if "whiteboard" in lowered or "margin" in lowered else "wrote"
    if "rewrote" in lowered:
        return "rewrote"
    if "compared" in lowered:
        return "compared"
    if "listened to" in lowered:
        return "listened to"
    if "admitted" in lowered:
        return "about"
    if "apologized" in lowered:
        return "about"
    if "replaying" in lowered:
        return "replaying"
    if "couldn't tell" in lowered or "don't know" in lowered or "wondering" in lowered or "wanted" in lowered or "knew" in lowered:
        return "about"
    if "opened" in lowered:
        return "opened"
    if "copied" in lowered:
        return "copied"
    if "stared" in lowered:
        return "about"
    if "told" in lowered:
        return "told"
    if "kept hearing" in lowered:
        return "hearing"
    if "deleted" in lowered:
        return "deleted from"
    if "restored" in lowered:
        return "restored"
    if "treating" in lowered:
        return "about"
    return "about"


def deterministic_links_for_record(record, shortlist, record_context):
    text = normalize_space(record["source_text"])
    lowered = text.lower()
    unit_lower = record_context["record_unit"]["unit_text"].lower()
    context_lower = record_context["context_text"].lower()
    refs = []
    uncertainties = []

    for artifact in shortlist:
        target_text = artifact_text(artifact)
        target_lower = target_text.lower()
        status = None

        if target_lower in lowered or canonical_event_text(target_text) in canonical_event_text(text):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "message" in lowered and "message" in target_lower and (not CONFIG["strict_object_head_matching"] or ("reply" not in target_lower and "draft" not in target_lower)):
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "scan" in lowered and "scan" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "copied" in lowered and any(token in target_lower for token in {"budget", "spreadsheet", "table", "graph", "trace", "log", "memo", "report"}):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "copied" in lowered and any(token in target_lower for token in {"reply", "email", "message"}):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and re.search(r"\bto ([A-Z][a-z]+)\b", text) and re.fullmatch(r"(?:Dr\. )?[A-Z][a-z]+", target_text) and target_text in text:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "apologized" in lowered and any(token in target_lower for token in {"demo", "visit", "call"}) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "apologized" in lowered and "walkthrough" in target_lower and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "apologized" in lowered and "interview" in target_lower and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "opened" in lowered and any(token in target_lower for token in {"reply", "draft", "email", "message"}):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "voicemail" in lowered and "voicemail" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "whiteboard" in lowered and "whiteboard" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "margin" in lowered and "margin" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "trace" in lowered and "trace" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "table" in lowered and "table" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "compared" in lowered and any(token in target_lower for token in {"table", "trace"}) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "circled" in lowered and any(token in target_lower for token in {"row", "line", "table", "graph", "trace", "window", "paragraph", "sentence", "margin", "note"}) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "memo" in lowered and "memo" in target_lower:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "reply" in lowered and "reply" in target_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "email draft" in lowered and (not CONFIG["strict_object_head_matching"] or "email draft" in target_lower):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "draft" in lowered and "reply" in lowered and (not CONFIG["strict_object_head_matching"] or "reply" in target_lower):
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "deleted" in lowered and any(token in target_lower for token in {"sentence", "paragraph"}) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "deleted" in lowered and "draft" in target_lower and target_text in record_context["context_text"]:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "deleted" in lowered and "reply" in target_lower and target_text in record_context["context_text"]:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and any(token in lowered for token in {"invoice", "memo", "report", "quote", "estimate", "clinic", "vendor", "contractor", "customer", "client"}) and any(token in target_lower for token in {"invoice", "memo", "report", "quote", "estimate", "clinic", "vendor", "contractor", "customer", "client", "partner", "team", "office", "board", "committee", "hospital", "school"}) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "whether" in lowered and re.search(r"\bbelong(?:ed)? in\b", lowered) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "them" in lowered and "parents" in target_lower and "parents" in unit_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and re.search(r"\b(she|he|him|her)\b", lowered) and target_text in record_context["context_text"] and re.search(r"\b[A-Z][a-z]+", target_text):
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "it" in lowered and "draft" in target_lower and "draft" in unit_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "it" in lowered and "note" in target_lower and "note" in unit_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "it" in lowered and "paragraph" in target_lower and "paragraph" in unit_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "restored" in lowered and "sentence" in target_lower and target_text in record_context["context_text"]:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "kept telling myself" in lowered and "voicemail" in target_lower and target_text in record_context["context_text"]:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "listened to" in lowered and "voicemail" in lowered and re.search(r"\b(?:Dr\. )?[A-Z][a-z]+\b", target_text):
            status = "explicit"
        elif artifact["artifact_kind"] == "encounter" and "apologized" in lowered and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and "it" in lowered and any(token in target_lower for token in {"sentence", "voicemail", "message", "line"}) and target_text in record_context["context_text"]:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "them" in lowered and "parents" in target_lower and "parents" in context_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "him" in lowered and "brother" in target_lower and "brother" in context_lower:
            status = "ambiguous"
        elif artifact["artifact_kind"] == "object" and "missed" in lowered and re.search(r"\b[A-Z][a-z]+\b", target_text) and target_text in record_context["context_text"]:
            status = "explicit"
        elif artifact["artifact_kind"] == "object" and any(token in lowered for token in {"did not text", "didn't text"}) and re.search(r"\b[A-Z][a-z]+\b", target_text) and target_text in record_context["context_text"]:
            status = "ambiguous"

        if not status:
            continue

        refs.append(
            {
                "from_candidate_id": record["candidate_id"],
                "to_candidate_id": artifact["candidate_id"],
                "relation_label": infer_relation_label(text),
                "relation_status": status,
                "supporting_text": text,
                "notes": "deterministic backfill" if status == "ambiguous" else "",
            }
        )
        if status == "ambiguous" and text not in uncertainties:
            uncertainties.append(text)

    return merge_reference_payloads({"candidate_references": refs, "uncertainties": uncertainties})


def reference_quality_score(ref, record_map, artifact_map):
    record_text = record_map[ref["from_candidate_id"]]["source_text"]
    artifact = artifact_map[ref["to_candidate_id"]]
    target_text = artifact_text(artifact)
    support = ref["supporting_text"]
    support_tokens = content_tokens(support)
    target_tokens = content_tokens(target_text)
    overlap = support_tokens & target_tokens

    score = 0
    if ref["relation_status"] == "explicit":
        score += 10
    if support == record_text:
        score += 25
    if len(support.split()) >= 4:
        score += 10
    if target_text.lower() in support.lower() or target_text.lower() in record_text.lower():
        score += 20
    score += min(len(overlap), 3) * 8
    record_lower = record_text.lower()
    target_lower = target_text.lower()
    if "reply" in record_lower and "reply" in target_lower:
        score += 18
    if "message" in record_lower and "message" in target_lower and "reply" not in target_lower:
        score += 12
    if "email draft" in record_lower and "email draft" in target_lower:
        score += 18
    if "note" in record_lower and "note" in target_lower:
        score += 12
    if "reply" in record_lower and "message" in target_lower and "reply" not in target_lower:
        score -= 10
    if "message" in record_lower and "reply" in target_lower:
        score -= 10
    if ref["relation_label"] in WEAK_REFERENCE_LABELS:
        score -= CONFIG["weak_label_penalty"]
    if len(support_tokens) < CONFIG["support_min_tokens"] and not is_short_pronominal_support(ref, record_text):
        score -= 30
    if CONFIG["drop_overbroad_encounters"] and artifact["artifact_kind"] == "encounter" and is_overbroad_encounter_span(target_text):
        score -= 50
    if ref.get("notes") == "deterministic backfill":
        score -= 3
    return score


def should_keep_reference(ref, record_map, artifact_map):
    record_text = record_map[ref["from_candidate_id"]]["source_text"]
    artifact = artifact_map[ref["to_candidate_id"]]
    target_text = artifact_text(artifact)
    support = ref["supporting_text"]
    support_tokens = content_tokens(support)
    target_tokens = content_tokens(target_text)
    overlap = support_tokens & target_tokens

    if len(support_tokens) < CONFIG["support_min_tokens"] and not is_short_pronominal_support(ref, record_text):
        return False
    if CONFIG["drop_overbroad_encounters"] and artifact["artifact_kind"] == "encounter" and is_overbroad_encounter_span(target_text):
        return False
    if CONFIG["drop_weak_no_overlap"] and ref["relation_label"] in WEAK_REFERENCE_LABELS and len(overlap) == 0 and support != record_text:
        return False
    if artifact["artifact_kind"] == "object" and len(target_tokens) >= 2 and len(overlap) == 0 and ref["relation_status"] == "explicit":
        return False
    if ref["relation_status"] == "explicit" and len(overlap) == 0 and target_text.lower() not in record_text.lower() and target_text.lower() not in support.lower():
        return False
    if CONFIG["drop_ambiguous_no_overlap"] and ref["relation_status"] == "ambiguous" and len(overlap) == 0 and target_text.lower() not in record_text.lower() and target_text.lower() not in support.lower():
        record_lower = record_text.lower()
        target_lower = target_text.lower()
        if "deleted" in record_lower and any(token in target_lower for token in {"draft", "reply"}):
            return True
        if "restored" in record_lower and any(token in target_lower for token in {"paragraph", "sentence"}):
            return True
        if any(token in record_lower for token in {"knew what it said", "telling myself"}) and any(token in target_lower for token in {"voicemail", "message", "note"}):
            return True
        if not PRONOUN_RE.search(support):
            return False
        if "read it again" in record_lower:
            return False
        if "restored" in record_lower and not any(token in target_lower for token in {"paragraph", "sentence"}):
            return False
        if "stared" in record_lower and "draft" not in target_lower:
            return False
        if "told them" in record_lower and "parents" not in target_lower:
            return False
    return True


def should_drop_in_support_competition(ref, competing_refs, record_map, artifact_map):
    record_text = record_map[ref["from_candidate_id"]]["source_text"]
    target_text = artifact_text(artifact_map[ref["to_candidate_id"]])
    support = ref["supporting_text"]
    support_tokens = content_tokens(support)
    target_tokens = content_tokens(target_text)
    overlap = support_tokens & target_tokens
    if ref["relation_status"] != "ambiguous":
        return False
    if overlap:
        return False
    if target_text.lower() in support.lower() or target_text.lower() in record_text.lower():
        return False
    record_lower = record_text.lower()
    target_lower = target_text.lower()
    if "deleted" in record_lower and any(token in target_lower for token in {"draft", "reply"}):
        return False
    if "restored" in record_lower and any(token in target_lower for token in {"paragraph", "sentence"}):
        return False
    if any(token in record_lower for token in {"knew what it said", "telling myself"}) and any(token in target_lower for token in {"voicemail", "message", "note"}):
        return False
    if not PRONOUN_RE.search(support):
        return False
    better_competitor = False
    for other in competing_refs:
        if other is ref:
            continue
        other_target = artifact_text(artifact_map[other["to_candidate_id"]])
        other_overlap = support_tokens & content_tokens(other_target)
        if other_overlap or other_target.lower() in support.lower() or other_target.lower() in record_text.lower():
            better_competitor = True
            break
    return better_competitor


def prune_phase2_output(phase2, phase1):
    record_map = {item["candidate_id"]: item for item in phase1.get("candidate_records", [])}
    artifact_map = {item["candidate_id"]: item for item in phase1.get("candidate_artifacts", [])}
    order_map = {
        (
            ref["from_candidate_id"],
            ref["to_candidate_id"],
            ref["supporting_text"],
            ref["relation_label"],
        ): idx
        for idx, ref in enumerate(phase2.get("candidate_references", []))
    }

    grouped = {}
    for ref in phase2.get("candidate_references", []):
        if ref["from_candidate_id"] not in record_map or ref["to_candidate_id"] not in artifact_map:
            continue
        if not should_keep_reference(ref, record_map, artifact_map):
            continue
        key = (ref["from_candidate_id"], ref["to_candidate_id"])
        score = reference_quality_score(ref, record_map, artifact_map)
        current = grouped.get(key)
        if current is None or score > current[0]:
            grouped[key] = (score, ref)

    refs_by_record = {}
    for (_, _), (score, ref) in grouped.items():
        refs_by_record.setdefault(ref["from_candidate_id"], []).append((score, ref))

    kept = []
    for from_id, items in refs_by_record.items():
        by_support = {}
        for score, ref in items:
            by_support.setdefault(ref["supporting_text"], []).append(ref)
        items.sort(key=lambda pair: (-pair[0], pair[1]["to_candidate_id"], pair[1]["supporting_text"]))
        limit = CONFIG["fanout_main"] if record_map[from_id]["process_type"] in {"thought", "behaviour"} else CONFIG["fanout_minor"]
        filtered_items = []
        for score, ref in items:
            competing_refs = by_support.get(ref["supporting_text"], [])
            if should_drop_in_support_competition(ref, competing_refs, record_map, artifact_map):
                continue
            filtered_items.append((score, ref))
        for _, ref in filtered_items[:limit]:
            kept.append(ref)

    kept.sort(key=lambda item: order_map.get((item["from_candidate_id"], item["to_candidate_id"], item["supporting_text"], item["relation_label"]), 10**9))
    for idx, ref in enumerate(kept, start=1):
        ref["candidate_reference_id"] = f"cr{idx}"

    seen_unc = set()
    uncertainties = []
    for text in phase2.get("uncertainties", []):
        clean = normalize_space(str(text))
        if clean and clean not in seen_unc:
            seen_unc.add(clean)
            uncertainties.append(clean)

    return {"candidate_references": kept, "uncertainties": uncertainties}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3.5:9b")
    parser.add_argument("--think", default="false")
    parser.add_argument("--stream", action="store_true")
    parser.add_argument("--output-dir", default="outputs-superpipeline-v1")
    parser.add_argument("--entry-file", default="large-difficult-entry.txt")
    parser.add_argument("--ollama-timeout-sec", type=int, default=120)
    parser.add_argument("--reuse-raw-from", default="")
    parser.add_argument("--drop-overbroad-encounters", type=int, default=1)
    parser.add_argument("--strict-object-head-matching", type=int, default=1)
    parser.add_argument("--drop-ambiguous-no-overlap", type=int, default=1)
    parser.add_argument("--drop-weak-no-overlap", type=int, default=1)
    parser.add_argument("--support-min-tokens", type=int, default=2)
    parser.add_argument("--fanout-main", type=int, default=3)
    parser.add_argument("--fanout-minor", type=int, default=2)
    parser.add_argument("--weak-label-penalty", type=int, default=18)
    args = parser.parse_args()

    CONFIG.update(
        {
            "drop_overbroad_encounters": bool(args.drop_overbroad_encounters),
            "strict_object_head_matching": bool(args.strict_object_head_matching),
            "drop_ambiguous_no_overlap": bool(args.drop_ambiguous_no_overlap),
            "drop_weak_no_overlap": bool(args.drop_weak_no_overlap),
            "support_min_tokens": args.support_min_tokens,
            "fanout_main": args.fanout_main,
            "fanout_minor": args.fanout_minor,
            "weak_label_penalty": args.weak_label_penalty,
            "reindex_phase1_after_prune": not bool(args.reuse_raw_from),
        }
    )

    outputs_dir = ROOT / args.output_dir
    ensure_outputs(outputs_dir)

    entry_path = Path(args.entry_file)
    if not entry_path.is_absolute():
        entry_path = ROOT / entry_path
    entry = entry_path.read_text(encoding="utf-8").strip()
    save(outputs_dir, "entry-source.txt", str(entry_path))
    records_prompt = read_text("super-phase-1-records-prompt.txt")
    encounters_prompt = read_text("super-phase-1-encounters-prompt.txt")
    objects_prompt = read_text("super-phase-1-objects-prompt.txt")
    record_links_prompt = read_text("super-phase-2-verify-pairs-prompt.txt")

    units = segment_local_work_units(entry)
    save(outputs_dir, "work-units.json", json.dumps(units, indent=2, ensure_ascii=False))

    substep_errors = []

    if args.reuse_raw_from:
        reuse_dir = Path(args.reuse_raw_from)
        if not reuse_dir.is_absolute():
            reuse_dir = ROOT / reuse_dir
        phase1_raw = json.loads((reuse_dir / "phase-1-raw-merged.json").read_text(encoding="utf-8"))
        phase2_raw = json.loads((reuse_dir / "phase-2-raw-merged.json").read_text(encoding="utf-8"))
        save(outputs_dir, "phase-1-raw-merged.json", json.dumps(phase1_raw, indent=2, ensure_ascii=False))
        phase1 = clean_phase2(phase1_raw, entry)
        phase1 = prune_phase1_output(phase1, entry)
        save(outputs_dir, "phase-1.json", json.dumps(phase1, indent=2, ensure_ascii=False))
        save(outputs_dir, "phase-2-raw-merged.json", json.dumps(phase2_raw, indent=2, ensure_ascii=False))
        phase2 = clean_phase3(phase2_raw, entry, phase1)
        phase2 = prune_phase2_output(phase2, phase1)
        save(outputs_dir, "phase-2.json", json.dumps(phase2, indent=2, ensure_ascii=False))
    else:
        # Super phase 1
        merged_records = []
        merged_encounters = []
        uncertainties = []
        for unit in units:
            blocks = [("work_unit_kind", unit["unit_kind"]), ("work_unit_text", unit["unit_text"])]
            deterministic_records = deterministic_records_for_unit(unit["unit_text"])
            if should_use_model_for_records(unit["unit_text"], unit["unit_kind"], deterministic_records):
                records_payload, error = safe_run_substep(
                    args.model,
                    args.think,
                    args.stream,
                    f"phase-1-records-{unit['unit_id']}",
                    records_prompt,
                    blocks,
                    normalize_records_payload,
                    outputs_dir,
                    f"phase-1-records-{unit['unit_id']}",
                    timeout_sec=args.ollama_timeout_sec,
                )
            else:
                records_payload = deterministic_records
                error = None
            records_payload = merge_records_payloads(records_payload, deterministic_records)
            save(outputs_dir, f"phase-1-records-{unit['unit_id']}.json", json.dumps(records_payload, indent=2, ensure_ascii=False))
            merged_records.extend(records_payload["candidate_records"])
            uncertainties.extend(records_payload["uncertainties"])
            if error:
                substep_errors.append({"substep": f"phase-1-records-{unit['unit_id']}", "error": error})

            if unit["unit_kind"] in {"narrative", "mixed"}:
                deterministic_encounters = deterministic_encounters_for_unit(unit["unit_text"])
                if deterministic_encounters["candidate_artifacts"]:
                    encounters_payload = deterministic_encounters
                    error = None
                else:
                    encounters_payload, error = safe_run_substep(
                        args.model,
                        args.think,
                        args.stream,
                        f"phase-1-encounters-{unit['unit_id']}",
                        encounters_prompt,
                        blocks,
                        normalize_encounters_payload,
                        outputs_dir,
                        f"phase-1-encounters-{unit['unit_id']}",
                        timeout_sec=args.ollama_timeout_sec,
                    )
                encounters_payload = merge_artifact_payloads(encounters_payload, deterministic_encounters)
                save(outputs_dir, f"phase-1-encounters-{unit['unit_id']}.json", json.dumps(encounters_payload, indent=2, ensure_ascii=False))
                merged_encounters.extend(encounters_payload["candidate_artifacts"])
                uncertainties.extend(encounters_payload["uncertainties"])
                if error:
                    substep_errors.append({"substep": f"phase-1-encounters-{unit['unit_id']}", "error": error})

        objects_payload = deterministic_objects_for_entry(entry)
        error = None

        full_entry_encounters = deterministic_encounters_for_unit(entry)
        merged_artifact_payload = merge_artifact_payloads(
            {"candidate_artifacts": merged_encounters, "uncertainties": []},
            full_entry_encounters,
            objects_payload,
        )
        phase1_raw = {
            "candidate_records": merged_records,
            "candidate_artifacts": merged_artifact_payload["candidate_artifacts"],
            "uncertainties": uncertainties + full_entry_encounters["uncertainties"] + objects_payload["uncertainties"],
        }
        phase1_raw = assign_temp_ids_phase1(phase1_raw)
        save(outputs_dir, "phase-1-raw-merged.json", json.dumps(phase1_raw, indent=2, ensure_ascii=False))
        phase1 = clean_phase2(phase1_raw, entry)
        phase1 = prune_phase1_output(phase1, entry)
        save(outputs_dir, "phase-1.json", json.dumps(phase1, indent=2, ensure_ascii=False))

        # Super phase 2
        merged_refs = []
        ref_uncertainties = []
        compact_artifacts = compact_artifacts_for_record_linking(phase1)
        for record in phase1.get("candidate_records", []):
            if is_noninformative_record_anchor(record["source_text"]):
                payload = {"candidate_references": [], "uncertainties": []}
                save(outputs_dir, f"phase-2-links-{record['candidate_id']}.json", json.dumps(payload, indent=2, ensure_ascii=False))
                continue
            record_context, candidate_pairs = build_candidate_pairs_for_record(record, compact_artifacts, units)
            candidate_pair_ids = {pair["to_candidate_id"] for pair in candidate_pairs}
            pair_artifacts = [artifact for artifact in compact_artifacts if artifact["candidate_id"] in candidate_pair_ids]
            deterministic_payload = deterministic_links_for_record(record, pair_artifacts, record_context)
            if deterministic_payload["candidate_references"]:
                payload = deterministic_payload
                error = None
            elif candidate_pairs:
                payload, error = safe_run_substep(
                    args.model,
                    args.think,
                    args.stream,
                    f"phase-2-links-{record['candidate_id']}",
                    record_links_prompt,
                    [
                        ("source_work_unit_kind", record_context["record_unit"]["unit_kind"]),
                        ("source_work_unit_text", record_context["record_unit"]["unit_text"]),
                        ("local_context_text", record_context["context_text"] or record_context["record_unit"]["unit_text"]),
                        ("source_record_json", json.dumps(record, ensure_ascii=False, separators=(",", ":"))),
                        ("candidate_pairs_json", json.dumps(candidate_pairs, ensure_ascii=False, separators=(",", ":"))),
                    ],
                    normalize_record_links_payload,
                    outputs_dir,
                    f"phase-2-links-{record['candidate_id']}",
                    timeout_sec=args.ollama_timeout_sec,
                )
            else:
                payload = {"candidate_references": [], "uncertainties": []}
                error = None
                save(outputs_dir, f"phase-2-links-{record['candidate_id']}.json", json.dumps(payload, indent=2, ensure_ascii=False))
            payload = merge_reference_payloads(payload, deterministic_payload)
            save(outputs_dir, f"phase-2-links-{record['candidate_id']}.json", json.dumps(payload, indent=2, ensure_ascii=False))
            merged_refs.extend(payload["candidate_references"])
            ref_uncertainties.extend(payload["uncertainties"])
            if error:
                substep_errors.append({"substep": f"phase-2-links-{record['candidate_id']}", "error": error})

        phase2_raw = assign_temp_ids_phase2({"candidate_references": merged_refs, "uncertainties": ref_uncertainties})
        save(outputs_dir, "phase-2-raw-merged.json", json.dumps(phase2_raw, indent=2, ensure_ascii=False))
        phase2 = clean_phase3(phase2_raw, entry, phase1)
        phase2 = prune_phase2_output(phase2, phase1)
        save(outputs_dir, "phase-2.json", json.dumps(phase2, indent=2, ensure_ascii=False))

    # Super phase 3
    phase3 = build_phase4_passthrough(phase1, phase2)
    save(outputs_dir, "phase-3.json", json.dumps(phase3, indent=2, ensure_ascii=False))

    summary = {
        "model": args.model,
        "work_unit_count": len(units),
        "phase_1_candidate_records": len(phase1.get("candidate_records", [])),
        "phase_1_candidate_artifacts": len(phase1.get("candidate_artifacts", [])),
        "phase_2_candidate_references": len(phase2.get("candidate_references", [])),
        "phase_3_candidate_records": len(phase3.get("candidate_records", [])),
        "phase_3_candidate_artifacts": len(phase3.get("candidate_artifacts", [])),
        "phase_3_candidate_references": len(phase3.get("candidate_references", [])),
        "substep_error_count": len(substep_errors),
    }
    save(outputs_dir, "substep-errors.json", json.dumps(substep_errors, indent=2, ensure_ascii=False))
    save(outputs_dir, "summary.json", json.dumps(summary, indent=2, ensure_ascii=False))

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
