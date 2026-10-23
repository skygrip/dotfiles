---
name: docling
description: Default document converter to extract clean Markdown or JSON from PDF, DOCX, PPTX, XLSX, HTML, and images (e.g. docling --to md FILE --output DIR).
---

# Docling Document Parsing Capabilities Reference

Document extraction and layout analysis CLI for converting complex digital and scanned documents (PDF, DOCX, PPTX, XLSX, HTML, AsciiDoc, CSV, XML, images) into clean Markdown, Docling JSON, or context-aware RAG chunks.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Raster Scan Without OCR** | Passing `--no-ocr` on scanned PDFs produces empty markdown output | Use `--ocr` for scanned/paper documents; reserve `--no-ocr` for digital PDFs |
| **Model Weight Download Trap** | Defaulting to OCR on digital PDFs downloads ~1–2 GB unnecessary weights | Always pass `--no-ocr --image-export-mode placeholder` for digital PDFs |
| **Base64 Context Flooding** | Embedding images inlines base64 URIs, consuming 50k–200k tokens | Always use `--image-export-mode placeholder` (or `referenced` for saved images) |
| **Long Document Timeout** | Corrupt or 500-page files hang subshell processes | Add `--document-timeout 120 --release-native-parser-memory 128` |
| **Corrupt PDF Circuit Breaker** | Complex multi-column PDFs can trigger parser crashes | If processing fails, reduce batch size: `docling FILE --page-batch-size 1 --output DIR` |

---

## 2. Supported Formats & Target Outputs Matrix

| Input Category | Supported Formats | Target Export Flag (`--to`) | Output Capabilities |
| :--- | :--- | :--- | :--- |
| **Portable Docs** | `.pdf` (Digital & Scanned) | `--to md` | Clean GFM Markdown with tables, headings, lists. |
| **Office OpenXML** | `.docx`, `.pptx`, `.xlsx` | `--to json` | Lossless Docling JSON (bounding boxes, layout nodes). |
| **Web & Markup** | `.html`, `.asciidoc`, `.csv`, `.xml` | `--to chunks` | Hierarchical `HybridChunker` RAG chunks with parent headers. |
| **Bitmap Images** | `.png`, `.jpg`, `.tiff`, `.bmp`, `.webp` | `--to html`, `--to text` | Clean HTML, token-level layout XML tags, or linearized text. |

---

## 3. Extraction Engines, Memory & Tuning Matrix

| Configuration | Flag / Parameter | Options / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **OCR Control** | `--ocr`, `--no-ocr` | Boolean toggle (Default: `--ocr`) | `--no-ocr` bypasses visual OCR; `--ocr` extracts scanned pages. |
| **OCR Engine** | `--ocr-engine` | `easyocr`, `rapidocr`, `tesseract` | Selects OCR backend and language: `--ocr-lang en,de,fr`. |
| **Table Fidelity** | `--table-mode` | `fast`, `accurate` | `accurate` invokes deep TableFormer for merged cells and borderless tables. |
| **Image Handling** | `--image-export-mode` | `placeholder`, `referenced` | `placeholder` emits markdown comments; `referenced` writes external images. |
| **Timeout & Memory**| `--document-timeout` | Seconds (e.g. `120`) | Per-document timeout to prevent hangs on complex files. |
| | `--page-batch-size` | Integer (default: `4`) | Pages per batch; reduce to `1` on memory-constrained systems. |
| | `--release-native-parser-memory` | Integer (default: `128`) | Flushes native C++ parser memory every $N$ pages. |
| **Concurrency** | `--num-threads` | Integer (default: `4`) | Number of worker threads for parallel document parsing. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Fast digital document conversion with output verification
docling manual.pdf --output ./extracted --no-ocr --image-export-mode placeholder
head -n 25 ./extracted/manual.md

# Stage 2: Scanned paper/fax document (Full neural OCR + TableFormer layout parsing)
docling scanned_doc.pdf --output ./out --ocr --ocr-engine easyocr --ocr-lang en --table-mode accurate --image-export-mode placeholder

# Stage 3: Large batch directory processing with memory & timeout safeguards
docling ./contracts --output ./extracted --from pdf --document-timeout 90 --page-batch-size 2 --no-ocr --num-threads 8
```
