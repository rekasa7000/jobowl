export function Readout({ rows }: { rows: [label: string, value: string][] }) {
  return (
    <dl className="panel w-full max-w-xl">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="readout-row flex items-baseline justify-between gap-6 px-5 py-3"
        >
          <dt className="meta-label">{label}</dt>
          <dd className="break-all text-right font-mono text-[0.8125rem]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
