#!/usr/bin/env python3
"""Transcribe audio from a video URL using faster-whisper.

Usage:
  python transcribe_faster_whisper.py --video-url <URL> [--model small] [--device cpu]

Outputs JSON to stdout:
{
  "segments": [
    {"text": "...", "start": 0.0, "duration": 3.2},
    ...
  ]
}
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List

try:
    import requests
except ImportError as exc:  # pragma: no cover - dependency hint
    raise SystemExit(
        "Missing 'requests'. Install dependencies via: pip install faster-whisper requests"
    ) from exc

try:
    from faster_whisper import WhisperModel
except ImportError as exc:  # pragma: no cover - dependency hint
    raise SystemExit(
        "Missing 'faster-whisper'. Install dependencies via: pip install faster-whisper"
    ) from exc


def download_file(url: str, destination: Path) -> None:
    with requests.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        with destination.open("wb") as file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    file.write(chunk)


def extract_audio(input_path: Path, output_path: Path, ffmpeg_binary: str = "ffmpeg") -> None:
    command = [
        ffmpeg_binary,
        "-y",
        "-i",
        str(input_path),
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_path),
    ]
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            "Failed to extract audio with ffmpeg",
            {"stdout": result.stdout, "stderr": result.stderr},
        )


def transcribe_audio(
    audio_path: Path,
    model_size: str,
    device: str,
    compute_type: str,
    beam_size: int,
    temperature: float,
) -> List[dict]:
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, _ = model.transcribe(
        str(audio_path),
        beam_size=beam_size,
        temperature=temperature,
    )

    result_segments: List[dict] = []
    for segment in segments:
        text = (segment.text or "").strip()
        if not text:
            continue
        start = float(segment.start or 0.0)
        end = float(segment.end or start)
        duration = max(0.0, end - start)
        result_segments.append({
            "text": text,
            "start": start,
            "duration": duration,
        })
    return result_segments


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe video audio using faster-whisper")
    parser.add_argument("--video-url", required=True, help="URL of the video file to download")
    parser.add_argument("--model", default=os.getenv("FASTER_WHISPER_MODEL", "small"), help="Whisper model size or local path")
    parser.add_argument("--device", default=os.getenv("FASTER_WHISPER_DEVICE", "cpu"), help="Device for inference (cpu/cuda)" )
    parser.add_argument("--compute-type", default=os.getenv("FASTER_WHISPER_COMPUTE", "int8"), help="Compute type, e.g. float16, int8")
    parser.add_argument("--beam-size", type=int, default=int(os.getenv("FASTER_WHISPER_BEAM_SIZE", "5")), help="Beam search size")
    parser.add_argument("--temperature", type=float, default=float(os.getenv("FASTER_WHISPER_TEMPERATURE", "0.0")), help="Sampling temperature")
    parser.add_argument("--ffmpeg-binary", default=os.getenv("FFMPEG_BINARY", "ffmpeg"), help="Path to ffmpeg executable")

    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="fw_transcribe_") as temp_dir:
        temp_path = Path(temp_dir)
        video_path = temp_path / "input_video"
        audio_path = temp_path / "audio.wav"

        try:
            download_file(args.video_url, video_path)
        except Exception as exc:  # pragma: no cover - network issues
            raise SystemExit(json.dumps({
                "error": "Failed to download video",
                "details": str(exc),
            }))

        try:
            extract_audio(video_path, audio_path, ffmpeg_binary=args.ffmpeg_binary)
        except Exception as exc:  # pragma: no cover - ffmpeg issues
            raise SystemExit(json.dumps({
                "error": "Failed to extract audio",
                "details": str(exc),
            }))

        try:
            segments = transcribe_audio(
                audio_path,
                model_size=args.model,
                device=args.device,
                compute_type=args.compute_type,
                beam_size=args.beam_size,
                temperature=args.temperature,
            )
        except Exception as exc:  # pragma: no cover - whisper issues
            raise SystemExit(json.dumps({
                "error": "Transcription failed",
                "details": str(exc),
            }))

    output = {
        "segments": segments,
    }
    json.dump(output, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
