---
name: docling
description: Default document converter to extract clean Markdown or JSON from PDF, DOCX, PPTX, XLSX, HTML, and images (e.g. docling FILE --output DIR --no-ocr --image-export-mode placeholder).
---

# Docling Document Parsing Capabilities Reference

Document extraction and layout analysis CLI for converting digital and scanned documents (PDF, DOCX, PPTX, XLSX, HTML, AsciiDoc, CSV, XML, images) into clean Markdown, Docling JSON, or context-aware RAG chunks. Enforces a **standard-Docling-first funnel**, escalating to the local VLM wrapper script only when standard digital or OCR pipelines fail on complex layouts.

---

## 1. Execution Primitives, Escalation Funnel & Circuit Breakers

| Tier / Rule | Trigger Condition & Operational Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Tier 1: Standard Digital (Default)** | Born-digital PDFs, DOCX, PPTX, XLSX, HTML with selectable text | `docling FILE --output DIR --no-ocr --image-export-mode placeholder` (layout + TableFormer, skips OCR) |
| **Tier 1b: Pure Native C++ PDF** | Large born-digital PDFs needing sub-second text extraction without ML layout models | `docling FILE --pipeline native --output DIR --image-export-mode placeholder` (PDF-only, zero GPU load) |
| **Tier 2: Standard OCR & Tables** | Ordinary scanned PDFs, raster images, or PDFs with broken font glyph mappings | `docling FILE --output DIR --ocr --table-mode accurate --image-export-mode placeholder` (or add `--replace-broken-pdf-text`) |
| **Tier 3: Local VLM Last-Resort** | Visually complex certificates, borderless key-value forms, or scans where Tiers 1–2 drop text or scramble columns | `uv run ~/.pi/agent/skills/docling/scripts/docling_vlm.py FILE --output DIR` (escalate only when standard `docling` is insufficient) |
| **Base64 Context Flooding** | Default `embedded` image mode inlines base64 URIs, consuming 50k–200k tokens | Always pass `--image-export-mode placeholder` (or `referenced` for saved PNG crops) |
| **Long Document Timeout** | Corrupt or 500-page files hang subshell processes | Add `--document-timeout 120 --release-native-parser-memory 128` |
| **Corrupt PDF Circuit Breaker** | Complex multi-column PDFs trigger parser crashes | If conversion fails, reduce batch size: `docling FILE --page-batch-size 1 --output DIR` |

---

## 2. Supported Formats & Target Outputs Matrix

| Input Category | Supported Formats | Target Export Flag (`--to`) | Output Capabilities |
| :--- | :--- | :--- | :--- |
| **Portable Docs** | `.pdf` (Digital & Scanned) | `--to md` | Clean GFM Markdown with tables, headings, lists. |
| **Office OpenXML** | `.docx`, `.pptx`, `.xlsx` | `--to json` | Lossless Docling JSON (bounding boxes, layout nodes). |
| **Web & Markup** | `.html`, `.asciidoc`, `.csv`, `.xml` | `--to chunks` | Hierarchical `HybridChunker` RAG chunks with parent headers. |
| **Visual Verification** | `.pdf`, images | `--to html_split_page --show-layout` | Side-by-side browser view of source page + layout bounding boxes vs. extracted HTML. |
| **Bitmap Images** | `.png`, `.jpg`, `.tiff`, `.bmp`, `.webp` | `--to html`, `--to text`, `--to doctags` | Clean HTML, linearized plain text, or token-level DocTags coordinates. |

---

## 3. Extraction Engines, Tuning & VLM Escalation Matrix

| Configuration | Flag / Parameter | Options / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Pipeline Mode** | `--pipeline` | `standard`, `native`, `vlm`, `asr` | `standard` (default layout + TableFormer); `native` (fast C++ PDF text stream only). |
| **OCR Control** | `--ocr`, `--no-ocr` | Boolean toggle (Default: `--ocr`) | Pass `--no-ocr` on digital docs to avoid OCR weight downloads; use `--ocr` for scans. |
| **OCR Engine** | `--ocr-engine` | `auto`, `rapidocr`, `easyocr`, `tesseract` | Selects local OCR backend and language: `--ocr-lang en,de,fr`. |
| **Broken PDF Fonts** | `--replace-broken-pdf-text` | Boolean flag | Replaces garbled unmapped PDF font layers with OCR automatically in `standard` pipeline. |
| **Table Fidelity** | `--table-mode` | `fast`, `accurate` | `accurate` (default) invokes deep TableFormer for merged cells and complex tables. |
| **Image Handling** | `--image-export-mode` | `placeholder`, `referenced` | `placeholder` emits markdown comments; `referenced` writes external PNG files. |
| **Timeout & Memory** | `--document-timeout` | Seconds (e.g. `120`) | Per-document timeout; pair with `--page-batch-size 4 --release-native-parser-memory 128`. |
| **Last-Resort VLM** | `scripts/docling_vlm.py` | `--vlm-model lightonocr3_4b` | Routes complex/scanned docs to local `http://localhost:8080` (`lightonocr3_4b`, `lightonocr3_08b`, `gemma4-12b`). |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Default digital conversion (Fast layout + TableFormer without OCR weight downloads)
docling manual.pdf --output ./extracted --no-ocr --image-export-mode placeholder
head -n 25 ./extracted/manual.md

# Stage 2: Standard scanned document or complex table extraction (Local OCR + accurate TableFormer)
docling scanned_report.pdf --output ./extracted --ocr --ocr-engine rapidocr --table-mode accurate --image-export-mode placeholder
head -n 25 ./extracted/scanned_report.md

# Stage 3: Last-resort local VLM escalation (Only when Stages 1-2 fail on complex forms, certificates, or borderless layouts)
uv run ~/.pi/agent/skills/docling/scripts/docling_vlm.py certificate.pdf --output ./extracted
head -n 25 ./extracted/certificate.md

# Stage 4: Large batch directory processing with memory & timeout safeguards
docling ./contracts --output ./extracted --from pdf --document-timeout 90 --page-batch-size 2 --no-ocr --num-threads 8
```
