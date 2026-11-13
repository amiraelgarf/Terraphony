/** "How it works" — the full method, sources and credits, readable without sound. */
import { useEffect, useState } from 'react';
import { useActions } from '../app/useActions';
import { OCEAN_RULE, OCEAN_SOURCE } from '../stories/ocean.config';
import { LAND_RULE, LAND_SOURCE } from '../stories/vegetation.config';
import { FIRE_COPY } from '../stories/fire.config';
import { Masthead } from './Masthead';
import { NoteTable } from './ScienceDialog';

type Manifest = {
  ocean: { picture: { frames: Record<string, { frame: number; timeUTC: string; landmarksPassed: number; landmarksTotal: number; maskAgreement: number }>; registrationVerified: boolean } };
  land: { places: { id: string; name: string; region: string; lat: number; lon: number; summary: { valid: number; total: number } }[] };
  officialResources: { n: number; title: string; url: string; role: string }[];
};

export function MethodScene() {
  const a = useActions();
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/manifest.json`).then((r) => r.json()).then(setM).catch(() => setM(null));
  }, []);

  return (
    <section className="scene scene--method" aria-labelledby="method-title">
      <Masthead tone="paper" />
      <div className="method">
        <header className="method__head">
          <span className="eyebrow eyebrow--copper">How it works</span>
          <h1 id="method-title" className="display">Every record has a story.<br /><em>Every note has an origin.</em></h1>
          <p>Earth Records turns real NASA Earth observations into short pieces of music. The sound is artistic; the numbers behind it are not invented. This page is the whole method.</p>
          <button className="cta cta--ink" onClick={() => a.go('library')}>Back to the records <span className="cta__arrow" aria-hidden="true">↗</span></button>
        </header>

        <article className="method__section">
          <h2>The one rule</h2>
          <pre className="method__code">u = clamp((value − lo) / (hi − lo), 0, 1){'\n'}note = [C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5][round(u × 10)]</pre>
          <p>The range <em>lo–hi</em> is fixed for each side and never rescaled, so the same value always plays the same note, on any route, place or date. Values outside the range are clamped and the inspector says so. Nearby values can share a note; the exact number is always shown.</p>
          <p>Arrangement: the melody plays alone first; a bass (mean of each block of 4 values) joins; accents mark changes above a declared threshold; a closing chord ends the record. The closing chord is artistic and carries no data. Instruments change timbre only.</p>
        </article>

        <article className="method__section method__two">
          <div>
            <span className="eyebrow eyebrow--copper">Side A · Ocean in Motion</span>
            <h2>A path through space</h2>
            <p><strong>Numbers:</strong> {OCEAN_SOURCE.datasetName} {OCEAN_SOURCE.productVersion} ({OCEAN_SOURCE.provider}), {OCEAN_SOURCE.variable}, {OCEAN_SOURCE.units}. {OCEAN_SOURCE.spatialResolution}. Accessed via {OCEAN_SOURCE.accessedVia}.</p>
            <p><strong>Picture:</strong> NASA SVS 3912, <em>Global Sea Surface Currents and Temperature</em> (ECCO2 model), frames for the same two days. The picture is context: it is a model visualization, the notes come from the separate MUR analysis. They are never mixed.</p>
            <ul className="plain-list">
              {OCEAN_SOURCE.transformNotes.map((t) => <li key={t}>{t}</li>)}
              <li>Fixed range {OCEAN_RULE.domainMin} to {OCEAN_RULE.domainMax} °C chosen from the pooled values of both days: from just below the freezing point of sea water up to 31 °C, which fewer than 0.5 % of open-ocean values exceed. Accent threshold {OCEAN_RULE.accentThreshold} °C.</li>
            </ul>
            {m && (
              <p className="muted">
                Registration check: {Object.values(m.ocean.picture.frames).map((f) => `frame ${f.frame} (${f.timeUTC.slice(0, 10)}): ${f.landmarksPassed}/${f.landmarksTotal} landmarks, ${(f.maskAgreement * 100).toFixed(1)} % land-mask agreement`).join('; ')}. {m.ocean.picture.registrationVerified ? 'Verified.' : 'NOT verified.'}
              </p>
            )}
          </div>
          <NoteTable story="ocean" />
        </article>

        <article className="method__section method__two">
          <div>
            <span className="eyebrow eyebrow--sage">Side B · A Year in One Place</span>
            <h2>A journey through time</h2>
            <p><strong>Numbers:</strong> {LAND_SOURCE.datasetName}, {LAND_SOURCE.productVersion}. {LAND_SOURCE.variable}. {LAND_SOURCE.spatialResolution}. Accessed via {LAND_SOURCE.accessedVia}.</p>
            <ul className="plain-list">
              {LAND_SOURCE.transformNotes.map((t) => <li key={t}>{t}</li>)}
              <li>One note per real 16-day composite window (23 start in 2023), labelled with its true dates. Month letters on the dial are calendar guides only.</li>
              <li>Fixed range {LAND_RULE.domainMin} to {LAND_RULE.domainMax} NDVI for every place. Accent threshold {LAND_RULE.accentThreshold}.</li>
            </ul>
            {m && (
              <ul className="plain-list muted">
                {m.land.places.map((p) => <li key={p.id}>{p.name}, {p.region} ({p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°): {p.summary.valid} of {p.summary.total} windows passed QA.</li>)}
              </ul>
            )}
          </div>
          <NoteTable story="vegetation" />
        </article>

        <article className="method__section">
          <span className="eyebrow eyebrow--muted">Side C · {FIRE_COPY.status}</span>
          <h2>{FIRE_COPY.name}</h2>
          <p>Not playable. It needs: {FIRE_COPY.needs.join(' ')}</p>
        </article>

        <article className="method__section">
          <h2>What stays true</h2>
          <ul className="plain-list">
            <li>Absolute temperature is not an anomaly. Greenness is not health. A detection is not a fire.</li>
            <li>Missing, masked or rejected values are rests, drawn as rings, never filled in.</li>
            <li>Same recipe → same notes → same sleeve. A recipe whose notes do not match its observations is refused when opened.</li>
            <li>Nothing you make leaves your browser unless you download it.</li>
          </ul>
        </article>

        {m && (
          <article className="method__section">
            <h2>The challenge&apos;s official resources</h2>
            <ol className="resource-list">
              {m.officialResources.map((r) => (
                <li key={r.n}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> — {r.role}</li>
              ))}
            </ol>
          </article>
        )}

        <article className="method__section method__credits">
          <h2>Credits</h2>
          <p>{OCEAN_SOURCE.credit}</p>
          <p>{LAND_SOURCE.credit}</p>
          <p>NASA/Goddard Space Flight Center Scientific Visualization Studio, SVS 3912: animators Greg Shirah, Horace Mitchell, Eric Sokolowsky; producer Michael Starobin; scientists Hong Zhang (UCLA), Dimitris Menemenlis (NASA/JPL). ECCO2 model (MIT/JPL).</p>
          <p>Coastlines: Natural Earth (public domain) via world-atlas. Fonts: Instrument Serif, DM Sans, DM Mono (SIL OFL). Sound: original, synthesized in the browser with Tone.js.</p>
          <p className="muted">An independent NASA Space Apps Challenge 2026 project. Not endorsed by NASA.</p>
        </article>
      </div>
    </section>
  );
}
