---
name: docling
description: Convert PDF, DOCX, PPTX, XLSX, HTML, and images to clean Markdown/JSON. Use 'docling <file> --output <dir> --no-ocr --image-export-mode placeholder' for fast document extraction.
---

# Docling Document Parsing Skill

This skill guides the agent on converting unstructured documents (PDF, DOCX, PPTX, XLSX, AsciiDoc, HTML, CSV, XML, images) into structured, LLM-ready Markdown, JSON, or chunks.

> [!IMPORTANT]
> **Performance & Timeout Prevention:**
> Always use `--no-ocr` and `--image-export-mode placeholder` unless OCR is explicitly required. Running bare `docling <file>` downloads multi-GB OCR weights and runs slow CPU models that can easily timeout tool calls.

---

## Operational Boundaries

### ✅ Use When:
- Target is a local document file: `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.html`, `.asciidoc`, `.xml`.
- Downstream task needs clean Markdown text, table schemas, or RAG chunks.
- You need structured Docling JSON (`--to json`) as ground-truth schema fallback.

### ❌ Do Not Use When:
- **Remote URLs**: `docling` is strictly a local parser. Download or fetch web pages locally first via `curl` or browser before passing to Docling.
- **Legacy Binary Office Formats (`.doc`, `.ppt`, `.xls`)**: Docling parses modern OpenXML (`.docx`, `.pptx`, `.xlsx`). Legacy Word 97–2003 `.doc` binary containers are unsupported and will fail. Convert first via `soffice --headless --convert-to docx <file>.doc` or request modern `.docx`/`.pdf`.
- **Password-Protected / Encrypted Files**: Decrypt or unlock documents before running.

---

## High-Leverage CLI Recipes

### 1. Fast Document Conversion (Recommended)
Converts digital documents preserving headings, reading order, and table layouts without slow OCR or image embedding:
```bash
docling <document-path> --output <output-dir> --no-ocr --image-export-mode placeholder
```

### 2. High-Accuracy Table Extraction
For complex tables (multi-line cells, merged headers, borderless tables), use accurate table mode:
```bash
docling <document-path> --output <output-dir> --no-ocr --table-mode accurate
```

### 3. Multi-Format & Chunk Export (RAG / Structured Extraction)
Export directly to Markdown, Docling JSON, or pre-chunked representations:
```bash
# Export Markdown and JSON
docling <document-path> --to md --to json --output <output-dir> --no-ocr

# Export context-aware chunks for RAG
docling <document-path> --to chunks --output <output-dir> --no-ocr
```

### 4. Scanned Documents & Images (OCR Required)
When processing scanned PDFs or image files where native text is unavailable:
```bash
docling <document-path> --output <output-dir> --ocr --ocr-engine easyocr --ocr-lang en
```
*(Engines: `easyocr`, `tesseract`, `rapidocr`, `ocrmac`)*

### 5. Batch Directory Conversion
Convert all matching documents in a folder:
```bash
docling ./docs --from pdf --output ./extracted_docs --no-ocr --image-export-mode placeholder
```

### 6. Hardware Acceleration & Threading
Accelerate processing on multi-core CPUs or dedicated GPUs:
```bash
# Multi-threaded CPU
docling <document-path> --output <output-dir> --threads 4 --device cpu --no-ocr

# CUDA GPU
docling <document-path> --output <output-dir> --device cuda
```

---

## Image Export Modes & Token Protection

> [!WARNING]
> **The Base64 Token Disaster:**
> Default markdown converters often embed images as raw `data:image/png;base64,...` data URIs. A single base64 image string can consume **50,000 to 200,000 tokens** of unparseable text, instantly blowing out the agent's context window. **Never use `embedded` image mode.**

| Mode (`--image-export-mode`) | Behavior | Agent Recommendation |
| :--- | :--- | :--- |
| **`placeholder`** *(Default Choice)* | Replaces images with lightweight markdown placeholders (e.g. `<!-- image -->` or figure captions). | ✅ **Optimal for LLMs.** Zero token waste while preserving figure captions and reading flow. |
| **`referenced`** | Saves images as external files to disk and links them via relative paths (e.g. `![](artifacts/fig1.png)`). | ✅ Use if the human user or a vision model needs to inspect the extracted image files on disk. |
| **`embedded`** | Encodes images as inline base64 data URIs inside the Markdown file. | ❌ **Anti-Pattern.** Wastes tens of thousands of tokens on raw binary strings. |

### Cleanest Recipe for LLM Reading (Zero Image Bloat)
```bash
docling <document-path> --output <output-dir> --no-ocr --image-export-mode placeholder
```

---

## Options & Flags Reference

| Flag | Values | Description |
| :--- | :--- | :--- |
| `--output <dir>` | Path | Directory where output files will be written. |
| `--to` | `md`, `json`, `html`, `chunks`, `doctags`, `text` | Target export format (repeatable for multiple formats). |
| `--from` | `pdf`, `docx`, `pptx`, `xlsx`, `html`, `asciidoc`, `csv`, `xml` | Restrict input format parser. |
| `--no-ocr` / `--ocr` | Boolean toggle | Disable/enable visual OCR (use `--no-ocr` for digital PDFs). |
| `--ocr-engine` | `easyocr`, `tesseract`, `rapidocr`, `ocrmac` | OCR engine to use when OCR is enabled. |
| `--ocr-lang` | `en`, `fr`, `de`, ... | Comma-separated list of OCR languages. |
| `--table-mode` | `fast`, `accurate` | Table structure extraction fidelity (`fast` default). |
| `--image-export-mode` | `placeholder`, `embedded`, `referenced` | Image handling (`placeholder` avoids context bloating). |
| `--threads` | Integer | Number of CPU worker threads. |
| `--device` | `auto`, `cpu`, `cuda`, `mps` | Compute device for deep-learning layout models. |
| `--artifacts-path` | Path | Directory for pre-downloaded offline model weights. |

---

## Supported Input Formats

- **PDF**: Native digital and scanned documents.
- **Office**: DOCX, PPTX, XLSX.
- **Web & Markup**: HTML, AsciiDoc, CSV, XML (USPTO, JATS, DocLang).
- **Images**: PNG, JPEG, TIFF, BMP, WebP (requires OCR).
