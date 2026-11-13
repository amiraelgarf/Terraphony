/**
 * MapLegend — NASA's own colour ramp (extracted from sst_ecco2_cbar.png) with
 * both readings made explicit: NASA's labels in °C on top, our image feature
 * (0–1, not a temperature) underneath. A marker shows the selected value.
 */
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';

export function MapLegend({ value }: { value: number | null }) {
  const { registry } = useJukebox();
  const stops = registry.legend.stops.map((s) => `rgb(${s.rgb.join(',')}) ${(s.position * 100).toFixed(1)}%`).join(', ');
  return (
    <figure className="legend" aria-label="Colour legend">
      <div className="legend-scale legend-scale-top" aria-hidden="true">
        <span>0 °C</span>
        <span className="legend-caption">{COPY.legendSourceNote}</span>
        <span>32 °C</span>
      </div>
      <div className="legend-bar" style={{ background: `linear-gradient(to right, ${stops})` }}>
        {value !== null && <span className="legend-marker" style={{ left: `${Math.min(1, Math.max(0, value)) * 100}%` }} aria-hidden="true" />}
      </div>
      <div className="legend-scale" aria-hidden="true">
        <span className="num">0</span>
        <span className="legend-caption">{COPY.legendVisual}</span>
        <span className="num">1</span>
      </div>
      <figcaption className="sr-only">
        NASA’s legend runs from blue at 0 °C to red at 32 °C, absolute modeled sea-surface temperature. Our instrument reads where a colour sits along this
        legend as a number from 0 to 1. That number is an image feature, not a temperature measurement.
        {value !== null ? ` The selected point reads ${value.toFixed(3)}.` : ''}
      </figcaption>
    </figure>
  );
}
