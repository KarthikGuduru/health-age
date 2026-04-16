import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import './Dashboard.css';

function fmt(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toFixed(digits);
}

function fmtInt(v) {
  if (v == null || isNaN(v)) return '—';
  return Math.round(v).toLocaleString();
}

export default function Dashboard({ result }) {
  const { parsed, bioAge } = result;
  const { metrics } = parsed;

  const diff = bioAge.diff;
  const isYounger = diff < 0;
  const diffAbs = Math.abs(diff);

  // Chart data from trends
  const trendData = parsed.trends?.vo2max
    ?.filter(t => t.avg != null)
    .map(t => ({ label: t.label, vo2: t.avg }));

  return (
    <main>
      {/* Hero result — black immersive section */}
      <section className="result-hero">
        <div className="container-wide">
          <div className="result-grid">
            <div className="result-main">
              <div className="result-label">Biological Age</div>
              <div className="result-number-wrap">
                <div className="result-number">
                  {bioAge.biologicalAge ? fmt(bioAge.biologicalAge, 1) : '—'}
                </div>
                <div className="result-unit">years</div>
              </div>
              <div className={`result-delta ${isYounger ? 'delta-better' : 'delta-worse'}`}>
                {diff === 0 ? 'Matches chronological age' :
                  `${fmt(diffAbs, 1)} years ${isYounger ? 'younger' : 'older'} than your calendar age`}
              </div>
              {bioAge.chronologicalAge && (
                <div className="result-chrono">
                  Calendar age: <strong>{fmt(bioAge.chronologicalAge, 1)}</strong>
                </div>
              )}
            </div>

            <div className="result-side">
              <div className="glass-stat">
                <div className="glass-stat-label">Health Score</div>
                <div className="glass-stat-value">{fmt(bioAge.healthScore, 0)}</div>
                <div className="glass-stat-meta">out of 100</div>
              </div>
              {bioAge.paceOfAging && (
                <div className="glass-stat">
                  <div className="glass-stat-label">Pace of Aging</div>
                  <div className="glass-stat-value">{bioAge.paceOfAging.pace}×</div>
                  <div className={`glass-stat-chip chip-${bioAge.paceOfAging.direction}`}>
                    {bioAge.paceOfAging.direction}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contributions — light section */}
      <section className="section section-light">
        <div className="container-wide">
          <h2 className="type-section-heading section-title">
            What's aging you.
          </h2>
          <p className="type-body section-lede">
            Each metric adds or subtracts years from your biological age.
            Green is helping you. Red is costing you.
          </p>

          <div className="contrib-grid">
            {bioAge.contributions.map(c => (
              <ContribCard key={c.metric} c={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Core metrics — dark section */}
      <section className="section section-dark">
        <div className="container-wide">
          <h2 className="type-section-heading section-title">
            30-day averages from your Apple Watch.
          </h2>
          <p className="type-body section-lede section-lede-dark">
            Pulled directly from your HealthKit export. Nothing left your browser.
          </p>

          <div className="metrics-grid">
            <MetricCard label="VO2 Max" value={fmt(metrics.vo2max.value, 1)} unit="mL/kg/min" samples={metrics.vo2max.count} />
            <MetricCard label="Resting Heart Rate" value={fmt(metrics.rhr.value, 0)} unit="bpm" samples={metrics.rhr.count} />
            <MetricCard label="Daily Steps" value={fmtInt(metrics.steps.value)} unit="steps" samples={metrics.steps.count} />
            <MetricCard label="Sleep" value={fmt(metrics.sleepDuration.value, 1)} unit="hrs" samples={metrics.sleepDuration.count} sub={`${fmt(metrics.sleepConsistency.value, 0)}% consistent`} />
            <MetricCard label="Zone 1–3 Cardio" value={fmt(metrics.hrZone13MinPerWeek?.value, 0)} unit="min/wk" samples={metrics.hrZone13MinPerWeek?.count} />
            <MetricCard label="Zone 4–5 Cardio" value={fmt(metrics.hrZone45MinPerWeek?.value, 0)} unit="min/wk" samples={metrics.hrZone45MinPerWeek?.count} />
            <MetricCard label="Strength Training" value={fmt(metrics.strengthMinPerWeek?.value, 0)} unit="min/wk" samples={metrics.strengthMinPerWeek?.count} />
            <MetricCard label="Lean Body Mass" value={fmt(metrics.leanBodyMassPct?.value, 1)} unit="%" samples={metrics.leanBodyMassPct?.count} sub={metrics.leanBodyMassPct?.value == null ? 'Enter via scale or Health app' : null} />
            <MetricCard label="Heart Rate Variability" value={fmt(metrics.hrv.value, 0)} unit="ms" samples={metrics.hrv.count} />
            <MetricCard label="Blood Oxygen" value={fmt(metrics.spo2.value, 1)} unit="%" samples={metrics.spo2.count} />
            <MetricCard label="Respiratory Rate" value={fmt(metrics.respiratoryRate.value, 1)} unit="br/min" samples={metrics.respiratoryRate.count} />
            <MetricCard label="Move Ring Closed" value={fmt(metrics.ringsClosedPct.value, 0)} unit="%" samples={metrics.ringsClosedPct.count} />
          </div>
        </div>
      </section>

      {/* VO2 Max trend */}
      {trendData && trendData.length >= 2 && (
        <section className="section section-light">
          <div className="container-wide">
            <h2 className="type-section-heading section-title">
              VO2 Max, over time.
            </h2>
            <p className="type-body section-lede">
              Cardiorespiratory fitness is the single strongest predictor of longevity.
            </p>
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="label" stroke="rgba(0,0,0,0.48)" style={{ fontSize: 12, fontFamily: 'var(--font-text)' }} />
                  <YAxis stroke="rgba(0,0,0,0.48)" domain={['dataMin - 2', 'dataMax + 2']} style={{ fontSize: 12, fontFamily: 'var(--font-text)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.94)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 11,
                      fontFamily: 'var(--font-text)',
                      fontSize: 13,
                    }}
                    formatter={(v) => [`${fmt(v, 1)} mL/kg/min`, 'VO2 Max']}
                  />
                  <Line type="monotone" dataKey="vo2" stroke="#0071e3" strokeWidth={3} dot={{ r: 6, fill: '#0071e3' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <div className="container">
          <span className="type-micro">
            Biological age is an estimate. Not medical advice.
            Based on research-backed ranges for RHR, HRV, VO2 Max, and sleep.
          </span>
        </div>
      </footer>
    </main>
  );
}

function ContribCard({ c }) {
  const delta = c.delta;
  const isGood = delta < 0;
  const isNeutral = Math.abs(delta) < 0.5;
  const cls = isNeutral ? 'neutral' : isGood ? 'good' : 'bad';

  return (
    <div className={`contrib-card contrib-${cls}`}>
      <div className="contrib-header">
        <div className="type-body-emphasis contrib-name">{c.name}</div>
        <div className={`contrib-delta delta-${cls}`}>
          {delta > 0 ? '+' : ''}{fmt(delta, 1)} yr
        </div>
      </div>
      <div className="contrib-value">
        <span className="contrib-num">{fmt(c.value, c.unit === '%' || c.unit === 'bpm' || c.unit === 'min/day' ? 0 : 1)}</span>
        <span className="contrib-unit"> {c.unit}</span>
      </div>
      <div className="type-caption contrib-desc">{c.description}</div>
    </div>
  );
}

function MetricCard({ label, value, unit, samples, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        <span className="metric-unit">{unit}</span>
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
      {samples != null && samples > 0 && (
        <div className="metric-meta">{samples.toLocaleString()} readings</div>
      )}
    </div>
  );
}
