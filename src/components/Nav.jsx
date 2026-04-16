import './Nav.css';

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Nav({ onReset, hasResult }) {
  return (
    <nav className="nav-glass">
      <div className="nav-inner">
        <button className="nav-brand" onClick={onReset} aria-label="Home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 5.5 6.5 12.5 6.5 12.5s6.5-7 6.5-12.5A6.5 6.5 0 0 0 12 2.5zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
          </svg>
          <span>Health Age</span>
        </button>
        <div className="nav-links">
          {hasResult ? (
            <>
              <button className="nav-link" onClick={() => scrollTo('dashboard')}>Dashboard</button>
              <button className="nav-link" onClick={() => scrollTo('metrics')}>Metrics</button>
              <button className="nav-link" onClick={() => scrollTo('trends')}>Trends</button>
              <button className="nav-link" onClick={() => scrollTo('zones')}>Zones</button>
              <button className="nav-action" onClick={onReset}>New Upload</button>
            </>
          ) : (
            <>
              <span className="nav-link nav-link-inactive">Dashboard</span>
              <span className="nav-link nav-link-inactive">Metrics</span>
              <span className="nav-link nav-link-inactive">Trends</span>
              <span className="nav-link nav-link-inactive">Zones</span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
