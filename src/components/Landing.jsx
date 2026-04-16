import { useRef, useState } from 'react';
import './Landing.css';

export default function Landing({ onFile, status, progress, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const busy = status === 'parsing';

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <main>
      {/* Hero — black section, cinematic */}
      <section className="hero-dark">
        <div className="hero-inner">
          <h1 className="type-display-hero hero-title">
            Your body has an age.
            <br />
            <span className="hero-title-accent">Let's measure it.</span>
          </h1>
          <p className="type-subheading hero-sub">
            Upload your Apple Health export. See your biological age,
            pace of aging, and which metrics are aging you.
          </p>

          <div className="hero-ctas">
            <button
              className="btn-primary"
              onClick={handleClick}
              disabled={busy}
            >
              {busy ? 'Processing…' : 'Upload Health Export'}
            </button>
            <a href="#how" className="btn-pill-outline">
              How it works &nbsp;›
            </a>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xml"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          {busy && (
            <div className="progress">
              <div className="progress-dot" />
              <span className="type-caption">{progress || 'Working…'}</span>
            </div>
          )}

          {error && (
            <div className="error-card">
              <span className="type-caption-bold">Something went wrong</span>
              <span className="type-caption">{error}</span>
            </div>
          )}
        </div>

        {/* Floating glass card preview */}
        <div className="hero-preview">
          <div className="glass-card">
            <div className="glass-card-label">Biological Age</div>
            <div className="glass-card-number">28.4</div>
            <div className="glass-card-delta">−3.2 years younger</div>
            <div className="glass-card-bar">
              <div className="glass-card-bar-fill" />
            </div>
          </div>
          <div className="glass-card glass-card-sm">
            <div className="glass-card-label">Pace of Aging</div>
            <div className="glass-card-number-sm">0.78×</div>
            <div className="glass-card-chip">improving</div>
          </div>
        </div>
      </section>

      {/* How it works — light section */}
      <section className="section section-light" id="how">
        <div className="container">
          <h2 className="type-section-heading how-title">
            Three steps. No data leaves your browser.
          </h2>

          <div className="how-grid">
            <HowStep
              n="1"
              title="Export from iPhone"
              body="Health app → Profile → Export All Health Data. You'll get a zip file with all your Apple Watch metrics."
            />
            <HowStep
              n="2"
              title="Upload to this app"
              body="Drag the zip in. We parse VO2 Max, HRV, resting heart rate, sleep, SpO2, and more — entirely in your browser."
            />
            <HowStep
              n="3"
              title="See your real age"
              body="Get a biological age estimate, a WHOOP-style pace of aging, and the metrics that matter most for your healthspan."
            />
          </div>
        </div>
      </section>

      {/* Drop zone */}
      <section
        className="section section-dark"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="container">
          <div className={`dropzone ${dragging ? 'dropzone-active' : ''}`} onClick={handleClick}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="dropzone-title type-tile-heading">
              Drop your <code className="inline-code">export.zip</code> here
            </div>
            <div className="dropzone-sub type-body">or click to browse</div>
            <div className="dropzone-hint type-caption">
              All processing happens on-device. Your health data never leaves this tab.
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span className="type-micro">
            Not medical advice. For personal tracking only.
          </span>
        </div>
      </footer>
    </main>
  );
}

function HowStep({ n, title, body }) {
  return (
    <div className="how-step">
      <div className="how-step-num">{n}</div>
      <div className="type-card-title how-step-title">{title}</div>
      <div className="type-body how-step-body">{body}</div>
    </div>
  );
}
