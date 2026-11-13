/**
 * RouteStepList — the non-visual alternative to the map: every route point as
 * a table row with position, value, note and status, plus Play and Inspect.
 */
import { fmtPosition, fmtValue } from '../app/format';
import { useJukebox } from '../app/JukeboxContext';

export function RouteStepList() {
  const { state, derived, actions } = useJukebox();
  const scan = derived.scans[state.frameKey];
  const selected = state.selection?.kind === 'step' ? state.selection.index : null;

  return (
    <details className="disclosure step-list">
      <summary>All {scan.samples.length} route points as a list</summary>
      <p className="muted small">Frame {state.frameKey} · {derived.routeLabel}. Use Play to hear one point, or Inspect to open its full explanation.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">Position</th>
              <th scope="col">Value</th>
              <th scope="col">Note</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {scan.samples.map((s, i) => {
              const e = scan.events[i];
              return (
                <tr key={i} className={selected === i ? 'is-selected' : ''} aria-selected={selected === i}>
                  <th scope="row" className="num">{i + 1}</th>
                  <td className="num">{fmtPosition(s.position)}</td>
                  <td className="num">{s.quantity ? fmtValue(s.quantity.value) : '—'}</td>
                  <td>{e.note ?? <span className="muted">rest ({s.invalidReason})</span>}{e.accent ? <span className="muted"> · accent</span> : ''}</td>
                  <td className="row-actions">
                    <button type="button" className="chip" disabled={!e.note} onClick={() => void actions.auditionSample(state.frameKey, i)} aria-label={`Play point ${i + 1}`}>
                      Play
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => actions.inspectSample(state.frameKey, i)}
                      aria-label={`Inspect point ${i + 1}`}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
