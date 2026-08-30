---
name: docling
description: Convert PDF, DOCX, PPTX, XLSX, HTML, and images to clean Markdown or JSON (e.g. docling FILE --output DIR).
---

# Docling Document Parsing Capabilities Reference

Document extraction and layout analysis CLI for converting complex digital and scanned documents (PDF, DOCX, PPTX, XLSX, HTML, AsciiDoc, CSV, XML, images) into clean Markdown, Docling JSON, or context-aware RAG chunks.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`docling`** | Document parsing CLI for layout analysis, TableFormer extraction, and format normalization |

---

## 2. Negative Guardrails & Context Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| `--no-ocr` on scanned PDFs | Bypasses OCR on raster images; produces **empty markdown** output | Use `--ocr` (or bare `docling`) for scanned/paper PDFs; reserve `--no-ocr` for digital PDFs |
| Bare `docling` on digital PDFs | Triggers unnecessary neural OCR, downloading ~1–2 GB weights | Pass `--no-ocr --image-export-mode placeholder` for digital PDFs |
| `--image-export-mode embedded` | Inlines raw base64 data URIs (`data:image/png;base64,...`), consuming 50k–200k tokens | Always use `--image-export-mode placeholder` (or `referenced` for external files) |
| Memory leaks on large batch runs | Unreleased C++ parser buffers exhaust process RAM | Add `--document-timeout 120 --release-native-parser-memory 128` |
| Remote URLs as input | `docling` is strictly a local file parser | Fetch or curl target locally first before invoking `docling` |
| Legacy binary formats (`.doc`, `.xls`) | Unsupported Word 97–2003 OLE containers fail to parse | Convert first with `soffice --headless --convert-to docx <file>.doc` |

---

## 3. Supported Input Formats & Target Outputs Matrix

| Input Category | Supported Formats | Target Export Flag (`--to`) | Output Capabilities |
| :--- | :--- | :--- | :--- |
| **Portable Docs** | `.pdf` (Digital & Scanned) | `--to md` | Clean GFM Markdown with tables, headings, lists. |
| **Office OpenXML** | `.docx`, `.pptx`, `.xlsx` | `--to json` | Lossless Docling JSON (bounding boxes, layout nodes, prov). |
| **Web & Markup** | `.html`, `.asciidoc`, `.csv`, `.xml` | `--to chunks` | Hierarchical `HybridChunker` RAG chunks with parent headers. |
| **Bitmap Images** | `.png`, `.jpg`, `.tiff`, `.bmp`, `.webp` | `--to html`<br/>`--to doctags`<br/>`--to text` | Clean HTML, token-level layout XML tags, or linearized text. |

---

## 4. Extraction Engines, Memory & Tuning Matrix

| Configuration | Flag / Parameter | Options / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **OCR Control** | `--ocr` / `--no-ocr` | Boolean toggle (Default: `--ocr`) | `--no-ocr` bypasses visual OCR; `--ocr` extracts scanned pages. |
| **OCR Engine** | `--ocr-engine` | `easyocr` (default), `rapidocr` (fast ONNX), `tesseract`, `ocrmac` | Selects OCR backend and language: `--ocr-lang en,de,fr`. |
| **Table Fidelity** | `--table-mode` | `fast` (default) \| `accurate` | `accurate` invokes deep TableFormer for merged cells and borderless tables. |
| **Image Handling** | `--image-export-mode` | `placeholder` \| `referenced` \| `embedded` | `placeholder` emits `<!-- image -->`; `referenced` saves `.png` files. |
| **Timeout & Memory**| `--document-timeout` | Seconds (e.g. `120`) | Per-document timeout to prevent hangs on corrupt 500-page files. |
| | `--page-batch-size` | Integer (default: `4`) | Pages per batch; reduce to `1` or `2` on low-VRAM machines. |
| | `--release-native-parser-memory` | Integer (default: `128`) | Flushes native C++ parser memory every $N$ pages. |
| | `--abort-on-error` | Boolean toggle | Controls whether batch directory processing halts on first error. |
| **Hardware** | `--device` | `auto`, `cpu`, `cuda`, `mps`, `xpu` | Hardware acceleration on NVIDIA GPU, CPU, or Apple Silicon. |
| **Concurrency** | `--num-threads` | Integer (default: `4`) | Number of worker threads for parallel document parsing. |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Fast digital document conversion (Zero model downloads or token bloat)
docling manual.pdf --output ./extracted --no-ocr --image-export-mode placeholder

# 2. Scanned paper/fax document (Full neural OCR + TableFormer layout parsing)
docling scanned_doc.pdf --output ./out --ocr --ocr-engine easyocr --ocr-lang en --table-mode accurate --image-export-mode placeholder

# 3. Large batch directory processing with memory & timeout safeguards
docling ./contracts --output ./extracted --from pdf --document-timeout 90 --page-batch-size 2 --no-ocr --num-threads 8
```
