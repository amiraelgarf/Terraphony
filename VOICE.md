# The host's voice — casting, direction, production and status

Beethoven in Earth Records is a **host portrayed as Beethoven**. His portrait is Stieler's 1820
painting (public domain); his words and voice are this project's own. It is not an impersonation and
not a historical recording. He invites, points and then steps aside: *the data
is the composer.*

## Status (missing-asset report)

| Item | Status |
|---|---|
| Script (13 cues, 40 phrases, direction per cue) | ✅ `src/tour/guideScript.en.json`. This one file drives the captions, the browser voice and the renderer. |
| Narration engine (clip → browser voice → captions) | ✅ `src/tour/narration.ts` |
| Tour director (cancellable state machine) | ✅ `src/tour/tourDirector.ts` |
| Recorded voice clips | ❌ **not yet produced**. `public/audio/guide/en/manifest.json` has `"cues": []` |
| Fallback in use until then | The most natural English voice on the device, scored to prefer neural ("Natural" / "Online" / "Premium") and warm lower voices. Each phrase uses its own pacing and pitch, with real silences between phrases. |

**Why the clips aren't included.** A natural, deep, emotional performance needs a human actor or a
licensed expressive neural voice. Both need an account or a licence that belongs to the team.
Nothing in this repository pretends to be that recording.

**Best result with no extra work:** open the app in **Microsoft Edge**. Its browser voices include
Microsoft's neural "Online (Natural)" voices. The app automatically picks a warm male one, such as
*Andrew*, *Brian* or *Guy*. Chrome on Windows has only older voices, so it sounds noticeably more
mechanical. You can choose the voice under **Adjust** in the caption bar.

## Casting

A warm mid-to-low register; textured and articulate. Lightly theatrical, but never pompous. Gentle
humour, and real surprise at the moment of discovery. **No cartoon German accent:** a modern, clear
voice is better than a fake historical imitation.

## Direction per cue

| Cue | Energy | Notes |
|---|---|---|
| `intro-01` | intimate / curious | Start softly. A tiny smile in "the Earth itself". Breathe before the reveal. |
| `choose-ocean` | warm / adventurous | An invitation, not a command. Let "anywhere" breathe. |
| `choice-ocean`, `choice-land` | pleased | A quick, warm nod that the visitor chose. |
| `first-notes`, `first-notes-land` | wonder / attentive | Slightly slower. Leave room for the first sound. "Listen." is almost a whisper. |
| `discovery` | surprised / precise | A short pause before "There." Don't oversell it. |
| `discovery-ocean`, `discovery-land`, `discovery-generic` | clear / grounded | Less drama. Say the coordinates, units and dates exactly. |
| `resume` | warm | Light; moving on. |
| `handover` | encouraging / playful | A gentle smile and a subtle lift on the last phrase. |
| `record-ready` | quietly delighted | A warm sense of completion, not a game-show win. |

The spoken numbers are checked against the data by `src/tests/narrationScript.test.ts`:
- **Gulf Stream:** stop 9, 39.9° N 59.5° W, 28.3 → 23.7 °C on 18 Aug 2007.
- **Nile Delta:** 26 Jun – 11 Jul 2023, NDVI 0.33 → 0.57.

## Producing the clips

**A — Voice actor (preferred).**
1. Record several takes of every cue. Edit the breaths and the emphasis, and master everything to
   one consistent loudness (for example −16 LUFS integrated, −1 dBTP).
2. Save the files in `public/audio/guide/en/`, using one of two naming schemes:
   - `<cueId>.mp3` — one file for the whole cue;
   - `<cueId>-1.mp3`, `-2`… — one file per phrase. This keeps captions exactly in sync.
3. Run:
   ```bash
   python scripts/voice/render_guide_voice.py recordings --name "Actor name"
   ```
4. If the actor changed any wording, edit the script so the captions match what is said.

**B — Licensed expressive neural TTS (ElevenLabs).** Use a voice you are allowed to use, and your
own key.

```powershell
$env:ELEVENLABS_API_KEY = "…"
python scripts/voice/render_guide_voice.py tts --voice-id <VOICE_ID> --voice-name "Host" --model eleven_multilingual_v2
# or --model eleven_v3: also sends the emotion tags ([softly], [surprised, quietly]…)
# re-render a single line:  --only discovery handover
```

How the renderer works:
- **One take per cue.** Each cue is performed in one take, with real pauses between phrases, so the
  phrasing flows naturally.
- **Caption sync.** Phrase start marks come from the service's character timestamps, so captions
  follow the actual audio.
- **Per-cue delivery.** Stability and style are set per cue in the script: lower stability for
  emotional cues, higher for the science cues.
- **Review.** Listen to every cue before shipping, and re-render any that sound flat.

When the manifest lists cues, the app uses them automatically. If a clip fails to load, that
phrase falls back to the browser voice, then to timed captions, and the tour never stalls.

## Playback rules (implemented)

- **Sound only after a gesture.** Nothing plays before the visitor clicks **Begin the narrated
  journey**.
- **No ducking.** The host speaks between musical phrases, so the music level is never moved. It is
  never stopped or reset.
- **Separate levels.** Narration and music each have their own level under **Adjust**. Pace has
  three settings (slower / natural / faster); recorded clips keep their pitch.
- **Captions always run.** Muting the voice never stops captions, progress or choices.
  **Replay** repeats the line without repeating its action.
- **No Beethoven compositions.** All music is original, and the host never claims any of it.
