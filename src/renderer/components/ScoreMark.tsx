import type { Verdict } from '@shared/schemas/discovery';

const WORDS: Record<Verdict, string> = {
  strong: 'Strong',
  possible: 'Possible',
  weak: 'Weak',
  no: 'Not a fit',
};

/** The score in the display face, with the verdict in words so colour isn't the only signal. */
export function ScoreMark({
  score,
  verdict,
  size = 'md',
}: {
  score: number | null;
  verdict: Verdict | null;
  size?: 'md' | 'lg';
}) {
  if (score === null || verdict === null) {
    return (
      <span className="flex flex-col items-center leading-none">
        <span
          className={`font-display ${size === 'lg' ? 'text-[2.5rem]' : 'text-[1.75rem]'} text-ink-3`}
        >
          –
        </span>
        <span className="meta-label mt-1" style={{ fontSize: '0.5625rem' }}>
          Unscored
        </span>
      </span>
    );
  }
  const tone =
    verdict === 'strong' ? 'text-accent-text' : verdict === 'possible' ? 'text-ink' : 'text-ink-3';
  return (
    <span className="flex flex-col items-center leading-none">
      <span
        className={`font-display ${size === 'lg' ? 'text-[2.5rem]' : 'text-[1.75rem]'} ${tone}`}
      >
        {score}
      </span>
      <span className="meta-label mt-1" style={{ fontSize: '0.5625rem' }}>
        {WORDS[verdict]}
      </span>
    </span>
  );
}
