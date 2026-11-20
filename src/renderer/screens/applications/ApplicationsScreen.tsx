import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { STATUS_LABELS, statusSchema, type Status } from '@shared/statuses';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { useApplicationList } from '../../lib/applications';

type StatusFilter = Status | 'all';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function ApplicationsScreen() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const list = useApplicationList({ search, status });
  const everything = useApplicationList({});
  const tracked = everything.data?.length ?? 0;
  const filtered = search.trim() !== '' || status !== 'all';

  // `/` jumps to search, `n` starts a new application. Ignored while typing or in a dialog.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'n') {
        event.preventDefault();
        void navigate('/applications/new');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
    const index = rows.findIndex((row) => row === document.activeElement);
    if (index === -1) return;
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }

  return (
    <>
      <ScreenHeader
        title="Applications"
        aside={tracked === 0 ? 'nothing tracked yet' : `${tracked} tracked`}
        actions={
          <Link to="/applications/new" className="btn-ink">
            Add application
          </Link>
        }
      />

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Application list"
          className="flex w-[45%] min-w-[340px] flex-col border-r-[1.5px] border-line"
        >
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <input
              ref={searchRef}
              type="search"
              className="input"
              placeholder="Search company, position or notes  ( / )"
              aria-label="Search applications"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.currentTarget.blur();
              }}
            />
            <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-2">
              {(['all', ...statusSchema.options] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={status === option}
                  className="chip"
                  onClick={() => setStatus(option)}
                >
                  {option === 'all' ? 'All' : STATUS_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {list.isError ? (
              <p role="alert" className="p-4 text-danger">
                Couldn't load your applications. Restart jobowl; if this keeps happening, check the
                log folder in your data directory.
              </p>
            ) : list.data && list.data.length > 0 ? (
              <ul onKeyDown={onListKeyDown} aria-label="Applications">
                {list.data.map((app) => (
                  <li key={app.id}>
                    <NavLink to={`/applications/${app.id}`} className="row-link">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{app.company}</span>
                          <span className="block truncate text-[0.8125rem] text-ink-2">
                            {app.position}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={app.status} />
                          <span className="font-mono text-[0.75rem] text-ink-3">
                            {app.dateApplied ?? 'no date'}
                          </span>
                        </span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : list.data ? (
              filtered ? (
                <div className="p-6">
                  <h2 className="font-display-caps text-[1.5rem]">Nothing matches these filters</h2>
                  <button
                    type="button"
                    className="btn-ghost mt-4"
                    onClick={() => {
                      setSearch('');
                      setStatus('all');
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="font-display-caps text-[1.5rem]">Nothing tracked yet</h2>
                  <p className="mt-2 text-ink-2">
                    Add an application you've sent, or bring in your jobowl 0.1 data from Settings.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <Link to="/applications/new" className="btn-ink">
                      Add application
                    </Link>
                    <Link to="/settings" className="btn-ghost">
                      Open Settings
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <p className="p-4 text-ink-3">Loading applications…</p>
            )}
          </div>
        </section>

        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </>
  );
}
