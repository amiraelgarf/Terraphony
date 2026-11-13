"""
Render or register the host's recorded voice (Beethoven, the fictional guide).

The app always works without this (captions + the best browser voice as a fallback).
Recorded clips are used automatically, in preference, once
public/audio/guide/en/manifest.json exists.

Two ways to produce them:

1) Expressive neural TTS (ElevenLabs, licensed voice, your own API key):

     set ELEVENLABS_API_KEY=...            (PowerShell: $env:ELEVENLABS_API_KEY="...")
     python scripts/voice/render_guide_voice.py tts --voice-id <VOICE_ID> [--model eleven_multilingual_v2|eleven_v3]

   One file per semantic cue (the whole line is performed in one take, so the
   prosody flows), with phrase start marks from the service's character
   timestamps so captions follow the actual audio. Per-cue stability/style come
   from the script ("tts" field); eleven_v3 also receives the emotion tags
   (e.g. [softly], [surprised, quietly]). Listen to every cue before shipping.

2) A human voice actor (preferred for production): put the edited, mastered takes in
   public/audio/guide/en/ named <cueId>.mp3|.wav (whole cue) or <cueId>-<n>.mp3|.wav
   (one file per phrase, n from 1), then:

     python scripts/voice/render_guide_voice.py recordings

   If the actor changed wording, edit src/tour/guideScript.en.json so captions match.

Only the Python standard library is used.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src" / "tour" / "guideScript.en.json"
OUT = ROOT / "public" / "audio" / "guide" / "en"
API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128"


def load_script() -> dict:
    return json.loads(SCRIPT.read_text(encoding="utf-8"))


def write_manifest(cues: list[dict], voice: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"locale": "en", "voice": voice, "cues": cues}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT / 'manifest.json'} ({len(cues)} cues)")


def build_text(cue: dict, model: str) -> tuple[str, list[int]]:
    """The performed text and the character offset where each phrase starts."""
    parts, starts, pos = [], [], 0
    for i, p in enumerate(cue["phrases"]):
        if i:
            pause = max(0.2, min(2.5, p.get("pauseBeforeMs", cue["phrases"][i - 1].get("pauseAfterMs", 300)) / 1000))
            sep = f' <break time="{pause:.1f}s" /> ' if model != "eleven_v3" else " … "
            parts.append(sep)
            pos += len(sep)
        tag = f'{p["tag"]} ' if model == "eleven_v3" and p.get("tag") else ""
        parts.append(tag)
        pos += len(tag)
        starts.append(pos)
        parts.append(p["text"])
        pos += len(p["text"])
    return "".join(parts), starts


def tts(args: argparse.Namespace) -> None:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY first (your own key, for a voice you are licensed to use).")
    script = load_script()
    OUT.mkdir(parents=True, exist_ok=True)
    cues = []
    for cue in script["cues"]:
        if args.only and cue["id"] not in args.only:
            continue
        text, starts = build_text(cue, args.model)
        st = cue.get("tts", {})
        body = {
            "text": text,
            "model_id": args.model,
            "voice_settings": {
                "stability": st.get("stability", 0.4),
                "similarity_boost": 0.8,
                "style": st.get("style", 0.4),
                "use_speaker_boost": True,
                "speed": args.speed,
            },
        }
        req = urllib.request.Request(
            API.format(voice=args.voice_id),
            data=json.dumps(body).encode("utf-8"),
            headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.loads(r.read().decode("utf-8"))
        (OUT / f"{cue['id']}.mp3").write_bytes(base64.b64decode(res["audio_base64"]))
        al = res.get("alignment") or res.get("normalized_alignment") or {}
        t0 = al.get("character_start_times_seconds") or []
        t1 = al.get("character_end_times_seconds") or []
        marks = [round(t0[min(s, len(t0) - 1)], 3) if t0 else 0.0 for s in starts]
        marks[0] = 0.0
        cues.append({"cueId": cue["id"], "clipUrl": f"{cue['id']}.mp3", "marks": marks, "duration": round(t1[-1], 3) if t1 else None})
        print(f"  {cue['id']}: {len(cue['phrases'])} phrases, {cues[-1]['duration']} s")
    write_manifest(cues, {"provider": "ElevenLabs", "name": args.voice_name or args.voice_id, "note": f"{args.model}; reviewed by ear before release"})


def wav_seconds(p: Path) -> float | None:
    try:
        with wave.open(str(p)) as w:
            return round(w.getnframes() / w.getframerate(), 3)
    except Exception:
        return None


def recordings(args: argparse.Namespace) -> None:
    script = load_script()
    cues, missing = [], []
    for cue in script["cues"]:
        cid, n = cue["id"], len(cue["phrases"])
        whole = next((OUT / f"{cid}{ext}" for ext in (".mp3", ".wav", ".m4a") if (OUT / f"{cid}{ext}").exists()), None)
        per = [next((f"{cid}-{i + 1}{ext}" for ext in (".mp3", ".wav", ".m4a") if (OUT / f"{cid}-{i + 1}{ext}").exists()), None) for i in range(n)]
        if any(per):
            cues.append({"cueId": cid, "phraseClips": per})
            if not all(per):
                missing.append(f"{cid}: phrases {[i + 1 for i, x in enumerate(per) if not x]} (browser fallback for those)")
        elif whole:
            dur = wav_seconds(whole) if whole.suffix == ".wav" else None
            lens = [len(p["text"]) for p in cue["phrases"]]
            # without measured marks, captions advance in proportion to text length
            total = dur or sum(lens) / 14.0
            acc, marks = 0, []
            for L in lens:
                marks.append(round(total * acc / sum(lens), 3))
                acc += L
            cues.append({"cueId": cid, "clipUrl": whole.name, "marks": marks, "duration": dur})
        else:
            missing.append(f"{cid}: no recording")
    write_manifest(cues, {"provider": "Recorded voice actor", "name": args.name})
    if missing:
        print("Missing (these use captions + browser voice):\n  " + "\n  ".join(missing))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("tts", help="render every cue with ElevenLabs")
    t.add_argument("--voice-id", required=True)
    t.add_argument("--voice-name", default=None)
    t.add_argument("--model", default="eleven_multilingual_v2", choices=["eleven_multilingual_v2", "eleven_v3"])
    t.add_argument("--speed", type=float, default=0.95)
    t.add_argument("--only", nargs="*", help="cue ids to (re)render")
    r = sub.add_parser("recordings", help="register a voice actor's files")
    r.add_argument("--name", default="Voice actor")
    a = ap.parse_args()
    tts(a) if a.cmd == "tts" else recordings(a)


if __name__ == "__main__":
    main()
