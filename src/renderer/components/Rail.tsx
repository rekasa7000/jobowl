import logo from '../jobowl.svg';

export function Rail() {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r-[1.5px] border-line bg-sunken px-4 py-5">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" width={36} height={36} className="brand-logo" />
        <span className="flex flex-col gap-1 leading-none">
          <span className="font-display text-2xl">jobowl</span>
          <span className="meta-label" style={{ fontSize: '0.5625rem' }}>
            Job search, locally
          </span>
        </span>
      </div>

      <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
        <a href="#home" className="nav-item" aria-current="page">
          <span className="meta-label">01</span>
          <span className="font-semibold">Home</span>
        </a>
      </nav>
    </aside>
  );
}
