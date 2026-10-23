#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "transformers",
#     "torch",
# ]
# ///
"""
OpenAI Privacy Filter - Fast Grep-Style Contextual PII Scanner
Scans text files, emails, and CSV datasets for 8 categories of sensitive personal data.
"""

import os
import sys
import csv
import json
import argparse
from pathlib import Path
from transformers import pipeline

# Ensure Windows terminal prints UTF-8 properly
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def merge_contiguous_spans(entities, line):
    """Merges adjacent subword tokens/spans belonging to the same entity category."""
    if not entities:
        return []
    
    merged = []
    current = None

    for e in entities:
        cat = e.get("entity_group", e.get("entity")).upper()
        if cat.startswith(("B-", "I-", "E-", "S-")):
            cat = cat[2:]
        start = e.get("start", 0)
        end = e.get("end", len(line))
        score = e.get("score", 0.0)

        if current is None:
            current = {"category": cat, "start": start, "end": end, "score": score}
        elif current["category"] == cat and start <= current["end"] + 1:
            current["end"] = max(current["end"], end)
            current["score"] = min(current["score"], score)
        else:
            merged.append(current)
            current = {"category": cat, "start": start, "end": end, "score": score}

    if current:
        merged.append(current)

    for m in merged:
        m["text"] = line[m["start"]:m["end"]].strip()

    return merged

def format_grep_output(file_path: Path, lines: list, findings: list, context: int = 1):
    lines_with_findings = {}
    for f in findings:
        lines_with_findings.setdefault(f["line_num"], []).append(f)

    if not lines_with_findings:
        return

    rel_name = file_path.name
    print(f"\n{'='*75}")
    print(f"  FILE: {rel_name}")
    print(f"{'='*75}")

    for line_num, ents in sorted(lines_with_findings.items()):
        labels_summary = ", ".join([f"{e['category']} ({e['confidence']:.0%}): '{e['text']}'" for e in ents])
        print(f"\n{rel_name}:{line_num}: [{labels_summary}]")
        print("-" * 75)

        start_idx = max(0, line_num - 1 - context)
        for i in range(start_idx, line_num - 1):
            print(f"  {i+1:3d}- {lines[i]}")

        print(f"> {line_num:3d}: {lines[line_num - 1]}")

        end_idx = min(len(lines), line_num + context)
        for i in range(line_num, end_idx):
            print(f"  {i+1:3d}- {lines[i]}")

def scan_path(target_path: Path, classifier, min_conf: float = 0.75, context: int = 1):
    files = sorted(target_path.rglob("*.*")) if target_path.is_dir() else [target_path]
    ignored_exts = {".parquet", ".zip", ".gz", ".png", ".jpg", ".exe", ".dll", ".pyc", ".db", ".sqlite"}
    
    all_findings = []
    flagged_files = 0
    total_files_scanned = 0

    for file_path in files:
        if file_path.suffix.lower() in ignored_exts or not file_path.is_file():
            continue

        total_files_scanned += 1
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            raw_lines = [l.rstrip("\r\n") for l in f.readlines()]

        file_findings = []
        for idx, line in enumerate(raw_lines, 1):
            if not line.strip():
                continue
            raw_entities = classifier(line, aggregation_strategy="simple")
            if raw_entities:
                merged = merge_contiguous_spans(raw_entities, line)
                for m in merged:
                    if m["score"] >= min_conf and m["text"]:
                        item = {
                            "file": str(file_path),
                            "filename": file_path.name,
                            "line_num": idx,
                            "category": m["category"],
                            "confidence": round(m["score"], 4),
                            "text": m["text"],
                            "line_content": line
                        }
                        file_findings.append(item)
                        all_findings.append(item)

        if file_findings:
            flagged_files += 1
            format_grep_output(file_path, raw_lines, file_findings, context=context)
        else:
            print(f"[CLEAN] {file_path.name}: No PII detected.")

    return all_findings, flagged_files, total_files_scanned

def main():
    parser = argparse.ArgumentParser(description="Grep-style PII scanner with context using OpenAI Privacy Filter")
    parser.add_argument("path", help="File or directory to scan")
    parser.add_argument("-C", "--context", type=int, default=1, help="Context lines before/after (default: 1)")
    parser.add_argument("--min-confidence", type=float, default=0.75, help="Minimum confidence threshold 0.0-1.0 (default: 0.75)")
    parser.add_argument("--output-csv", type=str, default="", help="Export findings to CSV file")
    parser.add_argument("--output-jsonl", type=str, default="", help="Export findings to JSON Lines file")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Error: Target path does not exist: {target}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Initializing official openai/privacy-filter model...")
    classifier = pipeline(task="token-classification", model="openai/privacy-filter")
    print(f"[*] Scanning: {target} (context={args.context}, min_confidence={args.min_confidence:.0%})\n")

    findings, flagged_files, total_scanned = scan_path(target, classifier, min_conf=args.min_confidence, context=args.context)

    print(f"\n{'='*75}")
    print(f"SCAN COMPLETE: {len(findings)} PII entities found across {flagged_files}/{total_scanned} files.")
    print(f"{'='*75}")

    if args.output_csv and findings:
        with open(args.output_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["file", "line_num", "category", "confidence", "text", "line_content"])
            w.writeheader()
            for row in findings:
                w.writerow({k: row[k] for k in ["file", "line_num", "category", "confidence", "text", "line_content"]})
        print(f"[+] Exported findings to CSV: {args.output_csv}")

    if args.output_jsonl and findings:
        with open(args.output_jsonl, "w", encoding="utf-8") as f:
            for item in findings:
                f.write(json.dumps(item) + "\n")
        print(f"[+] Exported findings to JSONL: {args.output_jsonl}")

if __name__ == "__main__":
    main()
