#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Docling CLI wrapper for local OpenAI-compatible VLM endpoints (llama-swap / vLLM).

Uses Docling's VlmConvertOptions.from_preset(..., engine_options=ApiVlmEngineOptions(...))
runtime pattern (see docs/examples/vlm_pipeline_api_model.py) while preserving full
`docling convert` CLI flag compatibility (--output, --to, --page-range, etc.).

Defaults to:
  - Endpoint:    http://localhost:8080/v1/chat/completions
  - Preset:      lightonocr3_4b (grounded Markdown + bboxes, temp=0.1, max_tokens=12288)
  - Concurrency: 4 (matches 4-slot llama-swap config for lightonocr3_4b)
  - Pipeline:    vlm (--enable-remote-services, --image-export-mode placeholder)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def _find_docling_python() -> Path | None:
    """Locate the Python interpreter inside the `docling` uv tool environment."""
    candidates: list[Path] = []

    appdata = os.environ.get("APPDATA")
    if appdata:
        candidates.append(Path(appdata) / "uv" / "tools" / "docling" / "Scripts" / "python.exe")
    home = Path.home()
    candidates.extend(
        [
            home / "AppData" / "Roaming" / "uv" / "tools" / "docling" / "Scripts" / "python.exe",
            home / ".local" / "share" / "uv" / "tools" / "docling" / "bin" / "python",
        ]
    )

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    if shutil.which("uv"):
        try:
            res = subprocess.run(
                ["uv", "tool", "dir"],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            tool_dir = Path(res.stdout.strip())
            for candidate in (
                tool_dir / "docling" / "Scripts" / "python.exe",
                tool_dir / "docling" / "bin" / "python",
            ):
                if candidate.is_file():
                    return candidate
        except Exception:
            pass

    return None


try:
    import docling  # noqa: F401
except ModuleNotFoundError:
    docling_py = _find_docling_python()
    if docling_py is None:
        sys.stderr.write(
            "Error: 'docling' package not found and could not locate uv tool 'docling' Python.\n"
            "Install with: uv tool install docling\n"
        )
        sys.exit(1)
    clean_env = {
        k: v
        for k, v in os.environ.items()
        if k
        not in (
            "PYTHONHOME",
            "PYTHONPATH",
            "VIRTUAL_ENV",
            "UV_INTERNAL__PYTHONHOME",
            "__PYVENV_LAUNCHER__",
        )
    }
    completed = subprocess.run([str(docling_py), __file__, *sys.argv[1:]], env=clean_env)
    sys.exit(completed.returncode)


import re
from docling.datamodel.pipeline_options import VlmConvertOptions
from docling.datamodel.stage_model_specs import StageModelPreset, VlmModelSpec
from docling.datamodel.vlm_engine_options import ApiVlmEngineOptions, VlmEngineType
from docling.models.inference_engines.vlm.api_openai_compatible_engine import ApiVlmEngine
from docling.pipeline.vlm_pipeline import ResponseFormat

DEFAULT_VLM_URL = os.environ.get("DOCLING_VLM_URL", "http://localhost:8080/v1/chat/completions")
DEFAULT_VLM_MODEL = os.environ.get("DOCLING_VLM_MODEL", "lightonocr3_4b")
DEFAULT_VLM_TIMEOUT = float(os.environ.get("DOCLING_VLM_TIMEOUT", "180.0"))
MODEL_DEFAULT_CONCURRENCY = {
    "lightonocr3_4b": 4,
    "lightonocr3_08b": 8,
    "gemma4-12b": 1,
}

DEFAULT_VLM_PROMPT = (
    "Convert this page to GitHub-Flavored Markdown (GFM). "
    "Do not miss any text and only output the bare markdown without wrapping code fences. "
    "Use Markdown headings (#, ##, ###) for titles and section headers, "
    "Markdown pipe tables (| Field | Value |) for tabular data, schedules, and aligned key-value rows, "
    "and separate distinct text blocks with a blank line."
)

_THINK_BLOCK_RE = re.compile(
    r"(?:<think>.*?</think>|<\|channel\>thought\n.*?<channel\|>)\s*",
    re.DOTALL,
)


def _strip_custom_flags(
    argv: list[str],
) -> tuple[list[str], str, str, str | None, float, int, float | None]:
    """Extract wrapper-specific flags before forwarding argv to docling.cli.main."""
    url = DEFAULT_VLM_URL
    model = DEFAULT_VLM_MODEL
    api_model_override: str | None = os.environ.get("DOCLING_VLM_API_MODEL")
    timeout = DEFAULT_VLM_TIMEOUT
    env_conc = os.environ.get("DOCLING_VLM_CONCURRENCY")
    concurrency: int | None = int(env_conc) if env_conc else None
    temperature: float | None = None

    cleaned: list[str] = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--vlm-url" and i + 1 < len(argv):
            url = argv[i + 1]
            i += 2
        elif arg.startswith("--vlm-url="):
            url = arg.split("=", 1)[1]
            i += 1
        elif arg == "--vlm-api-model" and i + 1 < len(argv):
            api_model_override = argv[i + 1]
            i += 2
        elif arg.startswith("--vlm-api-model="):
            api_model_override = arg.split("=", 1)[1]
            i += 1
        elif arg == "--vlm-timeout" and i + 1 < len(argv):
            timeout = float(argv[i + 1])
            i += 2
        elif arg.startswith("--vlm-timeout="):
            timeout = float(arg.split("=", 1)[1])
            i += 1
        elif arg == "--vlm-concurrency" and i + 1 < len(argv):
            concurrency = int(argv[i + 1])
            i += 2
        elif arg.startswith("--vlm-concurrency="):
            concurrency = int(arg.split("=", 1)[1])
            i += 1
        elif arg == "--vlm-temperature" and i + 1 < len(argv):
            temperature = float(argv[i + 1])
            i += 2
        elif arg.startswith("--vlm-temperature="):
            temperature = float(arg.split("=", 1)[1])
            i += 1
        else:
            if arg == "--vlm-model" and i + 1 < len(argv):
                model = argv[i + 1]
            elif arg.startswith("--vlm-model="):
                model = arg.split("=", 1)[1]
            cleaned.append(arg)
            i += 1

    lookup_key = api_model_override or model
    resolved_concurrency = (
        concurrency
        if concurrency is not None
        else MODEL_DEFAULT_CONCURRENCY.get(
            lookup_key, MODEL_DEFAULT_CONCURRENCY.get(model, 1)
        )
    )
    return cleaned, url, model, api_model_override, timeout, resolved_concurrency, temperature


def _register_dynamic_preset(preset_id: str, url: str) -> None:
    if preset_id not in VlmConvertOptions._presets:
        VlmConvertOptions.register_preset(
            StageModelPreset(
                preset_id=preset_id,
                name=preset_id,
                description=f"OpenAI-compatible VLM endpoint ({preset_id} @ {url})",
                model_spec=VlmModelSpec(
                    name=preset_id,
                    default_repo_id=preset_id,
                    prompt=DEFAULT_VLM_PROMPT,
                    response_format=ResponseFormat.MARKDOWN,
                    supported_engines={VlmEngineType.API},
                    temperature=0.0,
                    max_new_tokens=4096,
                ),
                scale=2.0,
                default_engine_type=VlmEngineType.API,
            )
        )
    else:
        preset = VlmConvertOptions._presets[preset_id]
        if preset.model_spec.supported_engines is not None:
            preset.model_spec.supported_engines.add(VlmEngineType.API)


def _configure_local_vlm(
    url: str,
    model: str,
    api_model_override: str | None,
    timeout: float,
    concurrency: int,
    temperature: float | None,
) -> None:
    """Register dynamic API presets and bind VlmConvertOptions.from_preset to ApiVlmEngineOptions."""
    orig_predict_batch = ApiVlmEngine.predict_batch

    def _clean_predict_batch(self: ApiVlmEngine, input_batch):
        outputs = orig_predict_batch(self, input_batch)
        for out in outputs:
            if out.text:
                out.text = _THINK_BLOCK_RE.sub("", out.text).strip()
        return outputs

    ApiVlmEngine.predict_batch = _clean_predict_batch  # type: ignore[method-assign]

    _register_dynamic_preset(model, url)

    orig_from_preset = VlmConvertOptions.from_preset.__func__  # type: ignore[attr-defined]

    @classmethod  # type: ignore[misc]
    def _patched_from_preset(cls, preset_id: str, engine_options=None, **overrides):
        _register_dynamic_preset(preset_id, url)
        if engine_options is None:
            resolved_api_model = (
                api_model_override
                if api_model_override is not None
                else ("gemma4-12b" if preset_id == "gemma_12b" else preset_id)
            )
            params: dict[str, object] = {
                "model": resolved_api_model,
                "chat_template_kwargs": {"enable_thinking": False},
            }
            if temperature is not None:
                params["temperature"] = temperature
            engine_options = ApiVlmEngineOptions(
                runtime_type=VlmEngineType.API,
                url=url,
                params=params,
                timeout=timeout,
                concurrency=concurrency,
            )
        return orig_from_preset(cls, preset_id, engine_options=engine_options, **overrides)

    VlmConvertOptions.from_preset = _patched_from_preset  # type: ignore[method-assign]


def main() -> None:
    raw_args = sys.argv[1:]
    (
        cleaned_args,
        url,
        model,
        api_model_override,
        timeout,
        concurrency,
        temperature,
    ) = _strip_custom_flags(raw_args)

    _configure_local_vlm(
        url=url,
        model=model,
        api_model_override=api_model_override,
        timeout=timeout,
        concurrency=concurrency,
        temperature=temperature,
    )

    is_meta_flag = any(
        a in ("-h", "--help", "--version", "options", "convert-remote") for a in cleaned_args
    )
    if cleaned_args and not is_meta_flag:
        if "--pipeline" not in cleaned_args and not any(
            a.startswith("--pipeline=") for a in cleaned_args
        ):
            cleaned_args.extend(["--pipeline", "vlm"])
        if "--vlm-model" not in cleaned_args and not any(
            a.startswith("--vlm-model=") for a in cleaned_args
        ):
            cleaned_args.extend(["--vlm-model", model])
        if "--enable-remote-services" not in cleaned_args:
            cleaned_args.append("--enable-remote-services")
        if "--image-export-mode" not in cleaned_args and not any(
            a.startswith("--image-export-mode=") for a in cleaned_args
        ):
            cleaned_args.extend(["--image-export-mode", "placeholder"])
        if "--page-batch-size" not in cleaned_args and not any(
            a.startswith("--page-batch-size=") for a in cleaned_args
        ):
            cleaned_args.extend(["--page-batch-size", str(max(4, concurrency))])

    sys.argv = [sys.argv[0], *cleaned_args]
    from docling.cli.main import app

    app()


if __name__ == "__main__":
    main()
