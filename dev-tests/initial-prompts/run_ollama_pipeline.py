#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LOW_VALUE_OBJECTS = {"mug", "the mug", "laptop", "my laptop", "the mug beside my laptop"}
THOUGHT_RE = re.compile(r"\b(wonder|wanted|knew|don't know|didn't know|couldn't tell|replay|hearing|heard|think|afraid|arguing)\b", re.I)
BEHAVIOUR_RE = re.compile(r"\b(reread|read|printed|copied|admitted|apologized|told|put|opened|stared|deleted|restored|emailed|sending|wrote|rewrote|compared|crossed|erased|listened|called)\b", re.I)
BODY_RE = re.compile(r"\b(tightened|swallow)\b", re.I)
EMOTION_RE = re.compile(r"\b(fine|wasn't fine|afraid)\b", re.I)
OTHER_PEOPLE_SPEECH_RE = re.compile(r"^(he|she|they|dr\. [A-Z][a-z]+|[A-Z][a-z]+|my (?:mother|father|parents|brother|sister))\s+(said|asked|told|laughed)\b", re.I)
UNCERTAINTY_RE = re.compile(r"\b(whether|don't know|didn't know|couldn't tell|or just for me)\b", re.I)
ENCOUNTER_RE = re.compile(r"\b(train|check-in|call|scan|dinner|ride|hearing|meeting)\b", re.I)
CARRIER_OBJECT_RE = re.compile(r"\b(message|note|draft|spreadsheet|slide|paragraph)\b", re.I)
SCENE_PREFIX_RE = re.compile(
    r"^(?:yesterday(?: morning| evening)?(?: on the [^,]+)?|during(?: the)? [^,]+,?|after(?:ward| the [^,]+)?|at dinner(?: with [^,]+)?|on the [^,]+|before(?: bed| sleep)?|later(?: that day| that night)?|then)\s+",
    re.I,
)
COMMA_CLAUSE_SPLIT_RE = re.compile(
    r",\s+(?=(?:I\b|my\b|if I\b|part of me\b|did not\b|didn't\b|couldn't\b|apologized\b|deleted\b|restored\b|crossed\b|rewrote\b|compared\b|circled\b|opened\b|kept hearing\b|kept telling\b))",
    re.I,
)


def read_text(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8").strip()


def ensure_outputs(outputs_dir: Path) -> None:
    outputs_dir.mkdir(parents=True, exist_ok=True)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def trim_leading_connector(text: str) -> str:
    trimmed = text.strip()
    for prefix in ("and then ", "and ", "but ", "then "):
        if trimmed.lower().startswith(prefix):
            return trimmed[len(prefix):].strip()
    return trimmed


def normalize_span(text: str) -> str:
    return normalize_space(trim_leading_connector(text))


def repair_span(entry: str, text: str) -> str:
    text = normalize_span(text)
    if not text:
        return ""
    candidates = [text]
    quote_fixed = (
        text.replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("‘", "'")
    )
    if quote_fixed not in candidates:
        candidates.append(quote_fixed)
    if quote_fixed.startswith("I "):
        candidates.append(quote_fixed[2:])
    if text.startswith("I "):
        candidates.append(text[2:])
    stripped_punct = text.rstrip('.,;:!?"\'')
    if stripped_punct and stripped_punct not in candidates:
        candidates.append(stripped_punct)
    if stripped_punct.startswith("I "):
        candidates.append(stripped_punct[2:])
    swap_quotes = quote_fixed.replace('"', "'") if '"' in quote_fixed else quote_fixed.replace("'", '"')
    if swap_quotes not in candidates:
        candidates.append(swap_quotes)
    if swap_quotes.startswith("I "):
        candidates.append(swap_quotes[2:])
    connective_variants = []
    for candidate in list(candidates):
        connective_variants.extend(
            [
                candidate.replace(", I ", ", but I "),
                candidate.replace(", I ", ", and I "),
                candidate.replace(", if ", "; if "),
                candidate.replace("; if ", ", if "),
                candidate.replace(", part of me ", ", and part of me "),
                candidate.replace(", my ", ", and my "),
            ]
        )
    for candidate in connective_variants:
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    for candidate in candidates:
        if candidate and candidate in entry:
            return candidate
    return ""


def infer_record_type(source_text: str, current_type: str) -> str:
    text = source_text.lower()
    if BODY_RE.search(text):
        return "body"
    if BEHAVIOUR_RE.search(text):
        return "behaviour"
    if THOUGHT_RE.search(text):
        return "thought"
    if "wasn't fine" in text:
        return "emotion"
    if EMOTION_RE.search(text) and current_type == "emotion":
        return "emotion"
    return current_type


def is_recordish_text(text: str) -> bool:
    lowered = text.lower()
    return lowered.startswith("i ") or BODY_RE.search(text) or BEHAVIOUR_RE.search(text) or THOUGHT_RE.search(text)


def canonical_event_text(text: str) -> str:
    lowered = normalize_space(text).lower()
    lowered = re.sub(r"^(the|a|an|at)\s+", "", lowered)
    lowered = re.sub(r",\s*my supervisor$", "", lowered)
    lowered = re.sub(r"[.?!,:;\"']+$", "", lowered)
    return lowered


def record_equivalence_key(text: str) -> str:
    lowered = canonical_event_text(text)
    lowered = re.sub(r"^i\s+", "", lowered)
    return lowered


def is_clipped_record_text(text: str) -> bool:
    lowered = record_equivalence_key(text)
    if lowered in {"wrote", "i wrote", "listened", "listened to", "i listened", "i listened to"}:
        return True
    if re.search(r"\bfrom (dr|mr|ms|mrs)\.?$", lowered):
        return True
    if lowered.endswith("only said"):
        return True
    return False


def is_noninformative_record_anchor(text: str) -> bool:
    lowered = record_equivalence_key(text)
    if lowered in {"again", "don't", "didn't", "doesn't", "won't", "can't"}:
        return True
    tokens = re.findall(r"[A-Za-z']+", lowered)
    content = [token for token in tokens if token not in {"i", "me", "my", "it", "them", "him", "her", "the", "a", "an"}]
    if not content and not re.search(r"\b(it|them|him|her)\b", lowered):
        return True
    return False


def artifact_primary_text(artifact: dict) -> str:
    if artifact["artifact_kind"] == "object":
        return artifact["source_text"]
    return artifact["source_texts"][0]


def is_more_specific_artifact_variant(shorter: dict, longer: dict) -> bool:
    if shorter["artifact_kind"] != longer["artifact_kind"]:
        return False
    short_text = artifact_primary_text(shorter)
    long_text = artifact_primary_text(longer)
    short_canon = canonical_event_text(short_text)
    long_canon = canonical_event_text(long_text)
    if not short_canon or not long_canon or short_canon == long_canon:
        return False
    if shorter["artifact_kind"] == "encounter" and long_canon.startswith(f"{short_canon},"):
        return True
    if re.match(r"^my brother [A-Z][a-z]+$", long_text) and short_canon in {"my brother", canonical_event_text(long_text.split()[-1])}:
        return True
    if re.match(r"^meeting with [A-Z][a-z]+, ", long_text) and long_canon.startswith(f"{short_canon},"):
        return True
    return False


def is_trivial_child_variant(parent_text: str, child_text: str) -> bool:
    parent = record_equivalence_key(parent_text)
    child = record_equivalence_key(child_text)
    if not parent or not child:
        return False
    if parent == child:
        return True
    return parent.startswith(child)


def artifact_family_key(artifact: dict) -> tuple:
    text = artifact["source_text"] if artifact["artifact_kind"] == "object" else artifact["source_texts"][0]
    canon = canonical_event_text(text)
    return (artifact["artifact_kind"], canon)


def artifact_sort_key(entry: str, item: dict) -> int:
    if item["artifact_kind"] == "object":
        return entry.find(item["source_text"])
    return entry.find(item["source_texts"][0])


def reindex_phase2(entry: str, records: list, artifacts: list) -> dict:
    records = sorted(records, key=lambda item: entry.find(item["source_text"]))
    artifacts = sorted(
        artifacts,
        key=lambda item: entry.find(item["source_text"] if item["artifact_kind"] == "object" else item["source_texts"][0]),
    )
    for idx, item in enumerate(records, start=1):
        item["candidate_id"] = f"r{idx}"
    for idx, item in enumerate(artifacts, start=1):
        item["candidate_id"] = f"a{idx}"
    return {"candidate_records": records, "candidate_artifacts": artifacts}


def add_or_replace_record(records_by_text: dict, source_text: str, process_type: str, notes: str = "") -> None:
    key = source_text.lower()
    records_by_text[key] = {
        "candidate_id": records_by_text.get(key, {}).get("candidate_id", ""),
        "process_type": process_type,
        "source_text": source_text,
        "notes": notes,
    }


def add_artifact_if_missing(artifacts_by_key: dict, artifact: dict) -> None:
    if artifact["artifact_kind"] == "object":
        key = ("object", artifact["source_text"].lower())
    else:
        key = ("encounter", tuple(text.lower() for text in artifact["source_texts"]))
    artifacts_by_key.setdefault(key, artifact)


def normalize_object_artifact_text(source_text: str) -> str:
    lowered = canonical_event_text(source_text)
    # Keep the message carrier separate from the topic it is about.
    if re.match(r"^[A-Z][a-z]+'s email about ", source_text):
        return re.match(r"^([A-Z][a-z]+'s email) about ", source_text).group(1)
    if re.match(r"^[A-Z][a-z]+'s note about ", source_text):
        return re.match(r"^([A-Z][a-z]+'s note) about ", source_text).group(1)
    match = re.match(r"^([A-Z][a-z]+'s message) about ", source_text)
    if match:
        return match.group(1)
    memo_match = re.match(r"^(.+ memo) to [^,.;]+$", source_text, re.I)
    if memo_match:
        return memo_match.group(1)
    return source_text


def record_contains_subrecord(parent_text: str, child_text: str) -> bool:
    parent = normalize_space(SCENE_PREFIX_RE.sub("", parent_text)).lower()
    child = normalize_space(SCENE_PREFIX_RE.sub("", child_text)).lower()
    if not parent or not child or parent == child:
        return False
    candidates = {
        child,
        trim_leading_connector(child),
        f"and {child}",
        f"and then {child}",
        f"then {child}",
        f"but {child}",
    }
    return any(candidate and candidate in parent for candidate in candidates)


def clean_phase2(payload: dict, entry: str) -> dict:
    records_by_text = {}
    for item in payload.get("candidate_records", []):
        source_text = repair_span(entry, item.get("source_text", ""))
        if not source_text:
            continue
        stripped_for_speech = SCENE_PREFIX_RE.sub("", source_text)
        if OTHER_PEOPLE_SPEECH_RE.match(source_text) or OTHER_PEOPLE_SPEECH_RE.match(stripped_for_speech):
            continue
        if re.search(r"\basked whether\b", source_text, re.I) and not re.match(r"^I asked whether\b", stripped_for_speech, re.I):
            continue
        if not is_recordish_text(source_text) and len(source_text.split()) < 3:
            continue
        if is_noninformative_record_anchor(source_text):
            continue
        process_type = infer_record_type(source_text, item.get("process_type", "thought"))
        add_or_replace_record(records_by_text, source_text, process_type, normalize_space(item.get("notes", "")))
        stripped = SCENE_PREFIX_RE.sub("", source_text)
        if stripped and stripped != source_text and not is_noninformative_record_anchor(stripped):
            add_or_replace_record(records_by_text, stripped, infer_record_type(stripped, process_type), "trimmed scene prefix")
        if process_type == "behaviour" and " before the " in source_text:
            left = normalize_space(source_text.split(" before the ", 1)[0])
            if left and not is_noninformative_record_anchor(left):
                add_or_replace_record(records_by_text, left, infer_record_type(left, process_type), "trimmed trailing context")
        if process_type == "behaviour" and " and " in source_text:
            left, _, right = source_text.partition(" and ")
            right = normalize_space(right)
            if left and right and re.match(r"^(copied|printed|opened|deleted|restored|wrote|rewrote|compared|crossed|listened|told)\b", right, re.I):
                if not is_noninformative_record_anchor(left):
                    add_or_replace_record(records_by_text, left, infer_record_type(left, process_type), "split chained behaviour")
                if not is_noninformative_record_anchor(right):
                    add_or_replace_record(records_by_text, right, infer_record_type(right, process_type), "split chained behaviour")
        if process_type == "thought" and ", and part of me wanted" in source_text.lower():
            left, right = re.split(r",\s*and\s+(?=part of me wanted)", source_text, maxsplit=1, flags=re.I)
            left = normalize_space(left)
            right = normalize_space(right)
            if left and not is_noninformative_record_anchor(left):
                add_or_replace_record(records_by_text, left, infer_record_type(left, process_type), "split chained thought")
            if right and not is_noninformative_record_anchor(right):
                add_or_replace_record(records_by_text, right, infer_record_type(right, process_type), "split chained thought")
        if process_type == "body" and " when " in source_text:
            left = normalize_space(source_text.split(" when ", 1)[0])
            if left and not is_noninformative_record_anchor(left):
                add_or_replace_record(records_by_text, left, infer_record_type(left, process_type), "trimmed trailing context")
        if ", " in source_text:
            parts = [normalize_space(part) for part in COMMA_CLAUSE_SPLIT_RE.split(source_text) if normalize_space(part)]
            if len(parts) > 1:
                for part in parts:
                    if not is_noninformative_record_anchor(part):
                        add_or_replace_record(records_by_text, part, infer_record_type(part, process_type), "split comma clause")

    cleaned_records = list(records_by_text.values())

    artifacts_by_key = {}
    for item in payload.get("candidate_artifacts", []):
        kind = item.get("artifact_kind")
        if kind == "object":
            source_text = repair_span(entry, item.get("source_text", ""))
            if not source_text:
                continue
            if is_recordish_text(source_text) and not re.match(r"^(message|email|note|draft|reply|sentence|paragraph|line|trace|table|report|scan|voicemail)\b", source_text.lower()):
                continue
            source_text = normalize_object_artifact_text(source_text)
            if source_text.lower() in LOW_VALUE_OBJECTS:
                continue
            canon_object = canonical_event_text(source_text)
            if ENCOUNTER_RE.search(source_text) and not CARRIER_OBJECT_RE.search(source_text) and "scan" not in canon_object:
                artifact = {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "encounter",
                    "source_texts": [source_text],
                    "notes": normalize_space(item.get("notes", "")),
                }
                add_artifact_if_missing(artifacts_by_key, artifact)
                continue
            artifact = {
                "candidate_id": item["candidate_id"],
                "artifact_kind": "object",
                "source_text": source_text,
                "notes": normalize_space(item.get("notes", "")),
            }
            add_artifact_if_missing(artifacts_by_key, artifact)
        elif kind == "encounter":
            repaired_texts = []
            for text in item.get("source_texts", []):
                repaired = repair_span(entry, text)
                if repaired:
                    repaired_texts.append(repaired)
            source_texts = list(dict.fromkeys(repaired_texts))
            if len(source_texts) > 1:
                scene_like = [text for text in source_texts if not is_recordish_text(text)]
                if scene_like:
                    source_texts = scene_like
            if not source_texts:
                continue
            if len(source_texts) == 1:
                only_text = source_texts[0]
                if is_recordish_text(only_text):
                    continue
                if "scan" == canonical_event_text(only_text):
                    continue
            artifact = {
                "candidate_id": item.get("candidate_id", ""),
                "artifact_kind": "encounter",
                "source_texts": source_texts,
                "notes": normalize_space(item.get("notes", "")),
            }
            add_artifact_if_missing(artifacts_by_key, artifact)
        else:
            continue

    cleaned_artifacts = list(artifacts_by_key.values())
    encounter_texts = {
        canonical_event_text(artifact["source_texts"][0])
        for artifact in cleaned_artifacts
        if artifact["artifact_kind"] == "encounter" and len(artifact["source_texts"]) == 1
    }
    cleaned_artifacts = [
        artifact
        for artifact in cleaned_artifacts
        if not (
            artifact["artifact_kind"] == "object"
            and any(
                canonical_event_text(artifact["source_text"]) == encounter_text
                and ENCOUNTER_RE.search(encounter_text)
                for encounter_text in encounter_texts
            )
        )
    ]
    encounter_exact_texts = {
        canonical_event_text(artifact["source_texts"][0])
        for artifact in cleaned_artifacts
        if artifact["artifact_kind"] == "encounter" and len(artifact["source_texts"]) == 1
    }
    object_texts = [
        artifact["source_text"]
        for artifact in cleaned_artifacts
        if artifact["artifact_kind"] == "object"
    ]
    reduced_artifacts = []
    for artifact in cleaned_artifacts:
        if artifact["artifact_kind"] == "object":
            canon = canonical_event_text(artifact["source_text"])
            if canon in encounter_exact_texts:
                continue
            if canon == "message" and any("message" in canonical_event_text(other) and canonical_event_text(other) != "message" for other in object_texts):
                continue
            if canon.endswith("memo") and any(canonical_event_text(other).endswith(canon) and canonical_event_text(other) != canon for other in object_texts):
                continue
        reduced_artifacts.append(artifact)
    cleaned_artifacts = reduced_artifacts

    deduped_artifacts = []
    seen_artifact_signatures = set()
    for artifact in sorted(cleaned_artifacts, key=lambda item: artifact_sort_key(entry, item)):
        signature = artifact_family_key(artifact)
        if signature in seen_artifact_signatures:
            continue
        seen_artifact_signatures.add(signature)
        if artifact["artifact_kind"] == "encounter":
            artifact["source_texts"] = [re.sub(r"^(the|At)\s+", "", text) if text.lower().startswith(("the ", "at ")) else text for text in artifact["source_texts"]]
        elif re.match(r"^(the|a|an)\s+", artifact["source_text"].lower()):
            artifact["source_text"] = re.sub(r"^(the|a|an)\s+", "", artifact["source_text"], flags=re.I)
        deduped_artifacts.append(artifact)
    cleaned_artifacts = deduped_artifacts

    specific_artifacts = []
    for artifact in cleaned_artifacts:
        if any(
            other is not artifact
            and is_more_specific_artifact_variant(artifact, other)
            for other in cleaned_artifacts
        ):
            continue
        specific_artifacts.append(artifact)
    cleaned_artifacts = specific_artifacts

    record_texts = {item["source_text"] for item in cleaned_records}
    record_keys = {record_equivalence_key(item["source_text"]) for item in cleaned_records}
    reduced_records = []
    for item in cleaned_records:
        source_text = item["source_text"]
        if is_noninformative_record_anchor(source_text):
            continue
        source_key = record_equivalence_key(source_text)
        if source_text.rstrip(".?!,;:") in record_texts and source_text.rstrip(".?!,;:") != source_text:
            continue
        if not source_text.lower().startswith("i ") and f"I {source_text}" in record_texts:
            continue
        if not source_text.lower().startswith("i ") and f"i {source_text}".lower() in {text.lower() for text in record_texts}:
            continue
        if not source_text.lower().startswith("i ") and f"i {source_key}" in record_keys:
            continue
        if is_clipped_record_text(source_text) and any(
            record_equivalence_key(other["source_text"]).startswith(source_key)
            and len(record_equivalence_key(other["source_text"])) > len(source_key)
            for other in cleaned_records
            if other is not item
        ):
            continue
        nontrivial_children = sum(
            1
            for other in cleaned_records
            if other is not item
            and len(other["source_text"]) < len(source_text)
            and record_contains_subrecord(source_text, other["source_text"])
            and not is_trivial_child_variant(source_text, other["source_text"])
        )
        if nontrivial_children >= 2 and len(source_text.split()) >= 8:
            continue
        if " even though " in source_text and source_text.split(" even though ", 1)[0] in record_texts:
            continue
        if ", but " in source_text and source_text.split(", but ", 1)[0] in record_texts:
            continue
        if ", and " in source_text and source_text.split(", and ", 1)[0] in record_texts:
            continue
        if " before the " in source_text and source_text.split(" before the ", 1)[0] in record_texts:
            continue
        if " when " in source_text and source_text.split(" when ", 1)[0] in record_texts:
            continue
        if " and " in source_text:
            left, _, right = source_text.partition(" and ")
            if left in record_texts and trim_leading_connector(right) in record_texts:
                continue
        if " and " in source_text:
            parts = [part.strip() for part in re.split(r"\s+and\s+", source_text) if part.strip()]
            if len(parts) > 1 and all(part in record_texts for part in parts):
                continue
        stripped = SCENE_PREFIX_RE.sub("", source_text)
        if stripped != source_text and stripped in record_texts:
            continue
        reduced_records.append(item)
    cleaned_records = reduced_records

    uncertainties = []
    seen_unc = set()
    for item in payload.get("uncertainties", []):
        text = normalize_space(item)
        if text and text not in seen_unc:
            seen_unc.add(text)
            uncertainties.append(text)

    for item in cleaned_records:
        if UNCERTAINTY_RE.search(item["source_text"]) and item["source_text"] not in seen_unc:
            seen_unc.add(item["source_text"])
            uncertainties.append(item["source_text"])

    reindexed = reindex_phase2(entry, cleaned_records, cleaned_artifacts)

    return {
        "candidate_records": reindexed["candidate_records"],
        "candidate_artifacts": reindexed["candidate_artifacts"],
        "uncertainties": uncertainties,
    }


def candidate_texts(phase2: dict) -> dict:
    mapping = {}
    for item in phase2.get("candidate_records", []):
        mapping[item["candidate_id"]] = [item["source_text"]]
    for item in phase2.get("candidate_artifacts", []):
        if item["artifact_kind"] == "object":
            mapping[item["candidate_id"]] = [item["source_text"]]
        else:
            mapping[item["candidate_id"]] = item.get("source_texts", [])
    return mapping


def clean_phase3(payload: dict, entry: str, phase2: dict) -> dict:
    source_map = candidate_texts(phase2)
    valid_candidate_ids = set(source_map.keys())
    refs_by_key = {}
    for item in payload.get("candidate_references", []):
        from_id = item.get("from_candidate_id", "")
        to_id = item.get("to_candidate_id", "")
        support = repair_span(entry, item.get("supporting_text", ""))
        if from_id not in valid_candidate_ids or to_id not in valid_candidate_ids:
            continue
        if not support:
            continue
        if not any(support in text for text in source_map.get(from_id, [])):
            continue
        status = item.get("relation_status", "ambiguous")
        if UNCERTAINTY_RE.search(support):
            status = "ambiguous"
        key = (from_id, to_id, support)
        refs_by_key[key] = {
            "candidate_reference_id": refs_by_key.get(key, {}).get("candidate_reference_id", ""),
            "from_candidate_id": from_id,
            "to_candidate_id": to_id,
            "relation_label": normalize_space(item.get("relation_label", "")),
            "relation_status": status,
            "supporting_text": support,
            "notes": normalize_space(item.get("notes", "")),
        }

    cleaned_refs = sorted(refs_by_key.values(), key=lambda item: entry.find(item["supporting_text"]))
    for idx, item in enumerate(cleaned_refs, start=1):
        item["candidate_reference_id"] = f"cr{idx}"

    uncertainties = []
    seen_unc = set()
    for item in payload.get("uncertainties", []):
        text = normalize_space(item)
        if text and text not in seen_unc:
            seen_unc.add(text)
            uncertainties.append(text)

    for item in cleaned_refs:
        if item["relation_status"] == "ambiguous" and item["supporting_text"] not in seen_unc:
            seen_unc.add(item["supporting_text"])
            uncertainties.append(item["supporting_text"])

    return {"candidate_references": cleaned_refs, "uncertainties": uncertainties}


def compact_phase2_for_phase4(phase2: dict) -> dict:
    return {
        "candidate_records": [
            {
                "candidate_id": item["candidate_id"],
                "process_type": item["process_type"],
                "source_text": item["source_text"],
            }
            for item in phase2.get("candidate_records", [])
        ],
        "candidate_artifacts": [
            (
                {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "object",
                    "source_text": item["source_text"],
                }
                if item["artifact_kind"] == "object"
                else {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "encounter",
                    "source_texts": item["source_texts"],
                }
            )
            for item in phase2.get("candidate_artifacts", [])
        ],
    }


def compact_phase3_for_phase4(phase3: dict) -> dict:
    return {
        "candidate_references": [
            {
                "candidate_reference_id": item["candidate_reference_id"],
                "from_candidate_id": item["from_candidate_id"],
                "to_candidate_id": item["to_candidate_id"],
                "relation_label": item["relation_label"],
                "relation_status": item["relation_status"],
                "supporting_text": item["supporting_text"],
            }
            for item in phase3.get("candidate_references", [])
        ]
    }


def build_phase4_passthrough(phase2: dict, phase3: dict) -> dict:
    return {
        "candidate_records": [
            {
                "candidate_id": item["candidate_id"],
                "process_type": item["process_type"],
                "source_text": item["source_text"],
                "notes": item.get("notes", ""),
                "absorbed_candidate_ids": [],
            }
            for item in phase2.get("candidate_records", [])
        ],
        "candidate_artifacts": [
            (
                {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "object",
                    "source_text": item["source_text"],
                    "notes": item.get("notes", ""),
                    "absorbed_candidate_ids": [],
                }
                if item["artifact_kind"] == "object"
                else {
                    "candidate_id": item["candidate_id"],
                    "artifact_kind": "encounter",
                    "source_texts": item["source_texts"],
                    "notes": item.get("notes", ""),
                    "absorbed_candidate_ids": [],
                }
            )
            for item in phase2.get("candidate_artifacts", [])
        ],
        "candidate_references": [
            {
                "candidate_reference_id": item["candidate_reference_id"],
                "from_candidate_id": item["from_candidate_id"],
                "to_candidate_id": item["to_candidate_id"],
                "relation_label": item["relation_label"],
                "relation_status": item["relation_status"],
                "supporting_text": item["supporting_text"],
                "notes": item.get("notes", ""),
                "absorbed_candidate_reference_ids": [],
            }
            for item in phase3.get("candidate_references", [])
        ],
        "removed_items": [],
        "soft_groups": [],
        "uncertainties": list(dict.fromkeys(phase2.get("uncertainties", []) + phase3.get("uncertainties", []))),
    }


def clean_phase4(payload: dict, phase2: dict, phase3: dict) -> dict:
    phase2_records = {item["candidate_id"]: item for item in phase2.get("candidate_records", [])}
    phase2_artifacts = {item["candidate_id"]: item for item in phase2.get("candidate_artifacts", [])}
    phase3_refs = {item["candidate_reference_id"]: item for item in phase3.get("candidate_references", [])}

    cleaned_records = []
    seen_records = set()
    for item in payload.get("candidate_records", []):
        candidate_id = item.get("candidate_id", "")
        if candidate_id in phase2_records and candidate_id not in seen_records:
            record = phase2_records[candidate_id]
            cleaned_records.append(
                {
                    "candidate_id": candidate_id,
                    "process_type": record["process_type"],
                    "source_text": record["source_text"],
                    "notes": normalize_space(item.get("notes", "")),
                    "absorbed_candidate_ids": list(dict.fromkeys(item.get("absorbed_candidate_ids", []))),
                }
            )
            seen_records.add(candidate_id)
    for candidate_id, record in phase2_records.items():
        if candidate_id not in seen_records:
            cleaned_records.append(
                {
                    "candidate_id": candidate_id,
                    "process_type": record["process_type"],
                    "source_text": record["source_text"],
                    "notes": "",
                    "absorbed_candidate_ids": [],
                }
            )

    cleaned_artifacts = []
    seen_artifacts = set()
    for item in payload.get("candidate_artifacts", []):
        candidate_id = item.get("candidate_id", "")
        if candidate_id in phase2_artifacts and candidate_id not in seen_artifacts:
            artifact = phase2_artifacts[candidate_id]
            if artifact["artifact_kind"] == "object":
                cleaned = {
                    "candidate_id": candidate_id,
                    "artifact_kind": "object",
                    "source_text": artifact["source_text"],
                    "notes": normalize_space(item.get("notes", "")),
                    "absorbed_candidate_ids": list(dict.fromkeys(item.get("absorbed_candidate_ids", []))),
                }
            else:
                cleaned = {
                    "candidate_id": candidate_id,
                    "artifact_kind": "encounter",
                    "source_texts": artifact["source_texts"],
                    "notes": normalize_space(item.get("notes", "")),
                    "absorbed_candidate_ids": list(dict.fromkeys(item.get("absorbed_candidate_ids", []))),
                }
            cleaned_artifacts.append(cleaned)
            seen_artifacts.add(candidate_id)
    for candidate_id, artifact in phase2_artifacts.items():
        if candidate_id not in seen_artifacts:
            cleaned_artifacts.append(
                (
                    {
                        "candidate_id": candidate_id,
                        "artifact_kind": "object",
                        "source_text": artifact["source_text"],
                        "notes": "",
                        "absorbed_candidate_ids": [],
                    }
                    if artifact["artifact_kind"] == "object"
                    else {
                        "candidate_id": candidate_id,
                        "artifact_kind": "encounter",
                        "source_texts": artifact["source_texts"],
                        "notes": "",
                        "absorbed_candidate_ids": [],
                    }
                )
            )

    cleaned_refs = []
    seen_refs = set()
    for item in payload.get("candidate_references", []):
        ref_id = item.get("candidate_reference_id", "")
        if ref_id in phase3_refs and ref_id not in seen_refs:
            ref = phase3_refs[ref_id]
            cleaned_refs.append(
                {
                    "candidate_reference_id": ref_id,
                    "from_candidate_id": ref["from_candidate_id"],
                    "to_candidate_id": ref["to_candidate_id"],
                    "relation_label": ref["relation_label"],
                    "relation_status": ref["relation_status"],
                    "supporting_text": ref["supporting_text"],
                    "notes": normalize_space(item.get("notes", "")),
                    "absorbed_candidate_reference_ids": list(dict.fromkeys(item.get("absorbed_candidate_reference_ids", []))),
                }
            )
            seen_refs.add(ref_id)
    for ref_id, ref in phase3_refs.items():
        if ref_id not in seen_refs:
            cleaned_refs.append(
                {
                    "candidate_reference_id": ref_id,
                    "from_candidate_id": ref["from_candidate_id"],
                    "to_candidate_id": ref["to_candidate_id"],
                    "relation_label": ref["relation_label"],
                    "relation_status": ref["relation_status"],
                    "supporting_text": ref["supporting_text"],
                    "notes": "",
                    "absorbed_candidate_reference_ids": [],
                }
            )

    return {
        "candidate_records": cleaned_records,
        "candidate_artifacts": cleaned_artifacts,
        "candidate_references": cleaned_refs,
        "removed_items": payload.get("removed_items", []),
        "soft_groups": payload.get("soft_groups", []),
        "uncertainties": list(dict.fromkeys(phase2.get("uncertainties", []) + phase3.get("uncertainties", []) + payload.get("uncertainties", []))),
    }


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


def normalize_phase_output(phase_name: str, payload: dict) -> dict:
    payload.setdefault("uncertainties", [])
    if phase_name == "phase-4":
        # Tolerate trivial schema omissions/aliases when the semantic content is otherwise intact.
        if "candidate_refs" in payload and "candidate_references" not in payload:
            payload["candidate_references"] = payload.pop("candidate_refs")
        for item in payload.get("candidate_references", []):
            if "candidate_reference_id" not in item and "candidate_id" in item:
                item["candidate_reference_id"] = item.pop("candidate_id")
        payload.setdefault("removed_items", [])
        payload.setdefault("soft_groups", [])
    return payload


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


def run_ollama(model: str, prompt: str, think_mode: str, stream: bool, stage_name: str, timeout_sec: int | None = None) -> str:
    if not stream and timeout_sec:
        completed = subprocess.run(
            ["timeout", "--signal=KILL", f"{timeout_sec}s", "ollama", "run", model, "--think", think_mode, "--format", "json"],
            input=prompt,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if completed.returncode in {124, 137}:
            raise RuntimeError(f"ollama timed out after {timeout_sec}s")
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr.strip() or f"ollama run failed with code {completed.returncode}")
        return completed.stdout

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
    compact_phase2 = compact_phase2_for_phase4(phase2)
    compact_phase3 = compact_phase3_for_phase4(phase3)
    return (
        f"{prompt}\n\n"
        f"<journal_entry>\n{entry}\n</journal_entry>\n\n"
        f"<phase_2_json>\n{json.dumps(compact_phase2, ensure_ascii=False, separators=(',', ':'))}\n</phase_2_json>\n\n"
        f"<phase_3_json>\n{json.dumps(compact_phase3, ensure_ascii=False, separators=(',', ':'))}\n</phase_3_json>\n\n"
        f"Return only the final JSON object.\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3:4b")
    parser.add_argument("--think", default="false", help="Ollama thinking mode: false, low, medium, or high")
    parser.add_argument("--stream", action="store_true", help="Stream raw model output to the terminal while saving it")
    parser.add_argument("--output-dir", default="outputs", help="Directory under this harness folder where run artifacts will be saved")
    parser.add_argument("--phase4-mode", choices=["model", "deterministic"], default="model", help="Use the model for phase 4 or use the cleaned deterministic passthrough")
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
    phase2 = clean_phase2(normalize_phase_output("phase-2", extract_json(raw2)), entry)
    validate_phase_output("phase-2", phase2)
    save(outputs_dir, "phase-2.json", json.dumps(phase2, indent=2, ensure_ascii=False))

    # Phase 3
    req3 = build_phase_3_request(phase3_prompt, entry, phase2)
    save(outputs_dir, "phase-3-request.txt", req3)
    raw3 = run_ollama(args.model, req3, args.think, args.stream, "phase-3")
    save(outputs_dir, "phase-3-raw.txt", raw3)
    phase3 = clean_phase3(normalize_phase_output("phase-3", extract_json(raw3)), entry, phase2)
    validate_phase_output("phase-3", phase3)
    save(outputs_dir, "phase-3.json", json.dumps(phase3, indent=2, ensure_ascii=False))

    # Phase 4
    req4 = build_phase_4_request(phase4_prompt, entry, phase2, phase3)
    save(outputs_dir, "phase-4-request.txt", req4)
    phase4_fallback_used = False
    if args.phase4_mode == "deterministic":
        phase4 = build_phase4_passthrough(phase2, phase3)
    else:
        try:
            raw4 = run_ollama(args.model, req4, args.think, args.stream, "phase-4")
            save(outputs_dir, "phase-4-raw.txt", raw4)
            phase4 = clean_phase4(normalize_phase_output("phase-4", extract_json(raw4)), phase2, phase3)
            validate_phase_output("phase-4", phase4)
        except Exception as exc:
            phase4_fallback_used = True
            save(outputs_dir, "phase-4-fallback-reason.txt", str(exc))
            phase4 = build_phase4_passthrough(phase2, phase3)
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
      "phase_4_fallback_used": phase4_fallback_used,
      "phase_4_mode": args.phase4_mode,
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
