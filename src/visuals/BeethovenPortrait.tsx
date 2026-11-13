/**
 * The host's portrait: Joseph Karl Stieler's 1820 portrait of Ludwig van Beethoven
 * (public domain, via Wikimedia Commons), framed as a small round cameo in the
 * house colours. The host's words are this project's own, not Beethoven's.
 *
 * Two restrained states:
 *   speaking  the cameo breathes slightly and three sound arcs pulse beside it
 *   baton     a gold baton gives one downbeat and is offered outward (the handover)
 */
const SRC = `${import.meta.env.BASE_URL}host/beethoven-stieler-1820.jpg`;

type Props = { size?: number; tone?: 'paper' | 'dark'; speaking?: boolean; gesture?: 'baton' | null; className?: string };

export function BeethovenPortrait({ size = 56, tone = 'dark', speaking = false, gesture = null, className = '' }: Props) {
  return (
    <span
      className={`portrait portrait--${tone}${speaking ? ' is-speaking' : ''}${gesture === 'baton' ? ' is-baton' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="portrait__frame">
        <img className="portrait__img" src={SRC} alt="" width={size} height={size} decoding="async" draggable={false} />
      </span>
      <svg viewBox="0 0 40 100" className="portrait__waves">
        <path d="M6 38 C11 44 11 56 6 62" />
        <path d="M14 30 C22 40 22 60 14 70" />
        <path d="M22 22 C33 36 33 64 22 78" />
      </svg>
      <span className="portrait__baton" />
    </span>
  );
}
