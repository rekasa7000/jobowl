export function EmptyDetail() {
  return (
    <div className="p-8">
      <h2 className="font-display-caps text-[1.75rem]">Pick an application</h2>
      <p className="mt-2 max-w-md text-ink-2">
        Choose one on the left to see its history and edit it, or add a new one.
      </p>
      <p className="mt-6 font-mono text-[0.8125rem] text-ink-3">
        ↑ ↓ move &nbsp;·&nbsp; / search &nbsp;·&nbsp; n add
      </p>
    </div>
  );
}
