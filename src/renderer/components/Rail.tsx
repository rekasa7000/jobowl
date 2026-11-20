import { NavLink } from 'react-router';
import logo from '../jobowl.svg';

const ITEMS = [
  { to: '/applications', label: 'Applications' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
] as const;

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
        {ITEMS.map((item, index) => (
          <NavLink key={item.to} to={item.to} className="nav-item">
            <span className="meta-label">{String(index + 1).padStart(2, '0')}</span>
            <span className="font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
