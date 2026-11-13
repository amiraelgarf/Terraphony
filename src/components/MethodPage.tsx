/**
 * MethodPage — sources, processing, validation, mapping, limitations,
 * transcript and credits. Every number here is read from the manifest.
 */
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { CHAPTERS } from '../content/story.en';
import { PITCHES } from '../domain/sonification';
import { formatUTC } from '../domain/sourceRegistry';
import { SonicLegend } from './SonicLegend';

export function MethodPage() {
  const { registry, derived, actions } = useJukebox();
  const m = registry.manifest;
  return (
    <article className="method">
      <header className="method-head">
        <p className="eyebrow">Method</p>
        <h1 className="chapter-title">How this sound was made</h1>
        <p className="caption">{COPY.provenance}</p>
        <button type="button" className="btn btn-quiet" onClick={() => actions.navigate('story')}>Return to the story</button>
      </header>

      <section>
        <h2>What you are hearing</h2>
        <p>
          The map is NASA’s own frame from <a href={m.sourceVisual} target="_blank" rel="noreferrer">SVS 3912, Global Sea Surface Currents and Temperature</a>: surface currents
          from the ECCO2 ocean model (MIT/JPL), drawn as traces and coloured by modeled absolute sea-surface temperature. NASA’s legend runs from 0 °C (blue) to 32 °C (red).
        </p>
        <p>
          <strong>Fidelity: visual-frame sonification.</strong> We did not obtain the numerical ECCO2 fields behind these exact frames, so the instrument does not read temperatures.
          It reads the picture: for each point, <em>where the colour sits on NASA’s legend</em>, as a number from 0 to 1. That number — the <em>normalized palette position</em> — is an
          image feature. It follows the legend, but it is not a calibrated temperature, and the app never shows it in °C.
        </p>
      </section>

      <section>
        <h2>Source frames</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Frame</th><th scope="col">NASA frame number</th><th scope="col">Model time (from NASA’s frame table)</th><th scope="col">Projection</th><th scope="col">SHA-256</th></tr></thead>
            <tbody>
              {m.availableFrames.map((f) => (
                <tr key={f.id}>
                  <th scope="row">{f.label}</th>
                  <td className="num"><a href={f.assetUrl} target="_blank" rel="noreferrer">{f.frameNumber}</a></td>
                  <td className="num">{formatUTC(f.captureOrModelTimeUTC)}</td>
                  <td>{f.visualProjection}</td>
                  <td className="num hash">{f.sha256?.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Documented visualization period: {formatUTC(m.timeRangeDocumentedUTC[0])} to {formatUTC(m.timeRangeDocumentedUTC[1])}. {COPY.historicalNote}</p>
      </section>

      <section>
        <h2>From pixels to a value</h2>
        <ol>
          <li>NASA’s legend image is read column by column. Its hue falls steadily from blue (about 228°) to red (about −6°), so every hue on the legend belongs to exactly one position between 0 and 1.</li>
          <li>Each frame pixel that is bright and saturated enough is matched to the legend <em>by hue only</em> — brightness varies along each streak, hue does not.</li>
          <li>Gray, unsaturated pixels are land (NASA’s shaded relief). Dark gaps between traces carry no colour.</li>
          <li>The frame is divided into 4×4-pixel cells (512×256). A cell’s value is the median of its matched pixels; its confidence combines how many pixels matched and how much they agree.</li>
          <li>Land cells and cells with too few matched pixels or low confidence become <strong>rests</strong>. Nothing is filled in or guessed.</li>
        </ol>
        <p className="muted small">Limitation: the last few percent of the legend share one hue (pure red), so values above about 0.97 read as about 0.97 — less than a third of one musical step.</p>
      </section>

      <section>
        <h2>Validation</h2>
        <ul>
          {Object.entries(m.registrationEvidence).map(([k, v]) => (
            <li key={k}>Geographic registration, frame {k}: <span className="num">{v}</span> (known land and sea points, several near coastlines) passed as an equirectangular −180…180°, −90…90° grid.</li>
          ))}
          <li>
            Frames A and B: same size and fixed camera; land masks agree on <span className="num">{(m.comparability.cellLandMaskAgreement * 100).toFixed(2)}%</span> of cells.
            {derived.comparability.ok ? ' Temporal comparison is enabled.' : ' Temporal comparison is disabled.'}
          </li>
          <li>The browser’s route sampler is unit-tested to reproduce the Python pipeline’s 64 samples exactly, on both frames.</li>
        </ul>
      </section>

      <section className="method-grid">
        <div>
          <h2>From a value to a note</h2>
          <p className="num">u = clamp((value − 0) ÷ (1 − 0), 0, 1) · index = round(u × 10) · note = scale[index]</p>
          <p>Scale: <span className="num">{PITCHES.join(' · ')}</span>. Quantized on purpose: nearby values can share a note, and the exact value is always shown.</p>
          <ul>
            <li><strong>Melody</strong> — the value at each route point, one note per beat, 96 BPM, 64 points ≈ 40 seconds.</li>
            <li><strong>Bass</strong> — the mean of valid values in each eight-point stretch, an octave lower.</li>
            <li><strong>Rhythm</strong> — a soft accent when the value changes by at least <span className="num">{registry.route.accentThreshold}</span> from the previous valid point (the 90th percentile of such spatial changes across frame A). A change along the route, not over time.</li>
            <li><strong>Atmosphere</strong> — a constant soft chord. Artistic, not data.</li>
          </ul>
          <p>Routes are resampled to 64 points at equal great-circle distance along the path as drawn, so zooming or resizing never changes the melody.</p>
        </div>
        <SonicLegend />
      </section>

      <section>
        <h2>What this is not</h2>
        <ul>
          <li>Not a temperature reading: the value is an image feature. It is never labelled in °C.</li>
          <li>Not a live feed: the model period is 2007–2008.</li>
          <li>Not the sound of the ocean: the music is our encoding, synthesized in your browser.</li>
          <li>Not a trend: frames A and B are two selected model times about six months apart — a seasonal contrast.</li>
          <li>Not a current speed: the flowing traces are not converted into velocities.</li>
        </ul>
      </section>

      <section>
        <h2>Transcript</h2>
        <ol className="transcript">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <p className="eyebrow"><span className="num">Scene {c.number}</span> · {c.eyebrow}</p>
              <h3>{c.title}</h3>
              <p>{c.caption}</p>
              {c.narration && <p className="narration">“{c.narration.visual}”</p>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>The challenge’s eleven NASA resources</h2>
        <ol className="resources">
          {registry.sources.map((s) => (
            <li key={s.n}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <span className="muted small">— {s.role}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Credits</h2>
        <p>{m.sourceCredits}. {m.creditsPeople}</p>
        <p className="muted">{COPY.independence} No NASA logos are used, and no NASA soundtrack is reused.</p>
      </section>
    </article>
  );
}
