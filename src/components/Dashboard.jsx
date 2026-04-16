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

  // Metrics costing more than 0.5 years, worst first (already sorted)
  const badContribs = bioAge.contributions.filter(c => c.delta > 0.5);

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

      {/* How to get it back down */}
      {badContribs.length > 0 && (
        <section className="section section-dark">
          <div className="container-wide">
            <h2 className="type-section-heading section-title">
              How to get it back down.
            </h2>
            <p className="type-body section-lede section-lede-dark">
              Focus here first. These are the metrics costing you the most years.
            </p>
            <div className="recs-list">
              {badContribs.map(c => {
                const rec = RECS[c.metric];
                if (!rec) return null;
                return (
                  <RecCard key={c.metric} c={c} rec={rec} />
                );
              })}
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

// ─── Recommendations ────────────────────────────────────────────────────────

const RECS = {
  vo2max: {
    icon: '🫁',
    headline: 'Raise your VO2 Max',
    why: 'VO2 Max is the single strongest predictor of longevity — each 1-MET improvement cuts all-cause mortality risk ~15%.',
    steps: [
      'Do 2× zone 4–5 sessions per week: 4–8 × 4-min intervals at 85–95% max HR with equal rest.',
      'Add one long easy run or bike ride (60–90 min zone 2) weekly to build aerobic base.',
      'Norwegian 4×4: 4 min hard, 3 min easy, repeat 4 times — the most-studied protocol for VO2 Max gains.',
      'Expect +1–3 mL/kg/min within 8–12 weeks of consistent training.',
    ],
  },
  rhr: {
    icon: '❤️',
    headline: 'Lower your resting heart rate',
    why: 'Every 10 bpm above ~60 bpm raises all-cause mortality risk ~9%. RHR drops as cardio fitness improves.',
    steps: [
      'Prioritise zone 2 cardio (conversational pace) 3–4× per week — the most direct driver of RHR reduction.',
      'Cut alcohol: even moderate drinking raises next-morning RHR by 3–7 bpm.',
      'Manage stress — chronic cortisol keeps sympathetic tone high; try 5 min of slow breathing (4-7-8 or box breathing) daily.',
      'Aim for consistent sleep timing; irregular sleep is a major driver of elevated RHR.',
    ],
  },
  steps: {
    icon: '🚶',
    headline: 'Walk more every day',
    why: 'Each extra 1,000 steps/day reduces mortality risk ~6%, up to ~12k steps. Easiest longevity lever you have.',
    steps: [
      'Set a 10k-step floor. Use watch reminders or park further away — non-exercise activity matters as much as workouts.',
      'Walk after meals: a 10–15 min post-meal walk cuts blood glucose spikes and adds ~1,500 steps effortlessly.',
      'Take calls walking. Replace 30 min of sitting with standing/walking per hour.',
      'If you hit 10k, try for 12k — the dose-response curve continues to ~12,000 steps.',
    ],
  },
  sleepDuration: {
    icon: '😴',
    headline: 'Hit 7–8 hours of sleep',
    why: 'Short sleep (<6 hrs) raises all-cause mortality risk ~35%. Sleep is the only intervention that repairs every organ simultaneously.',
    steps: [
      'Set a fixed wake time every day (including weekends) — this is the anchor that regulates your entire circadian rhythm.',
      'Work backwards 7.5–8 hrs for your bedtime. Protect it like a meeting.',
      'No screens 45 min before bed. Blue light suppresses melatonin for 3+ hours.',
      'Keep your bedroom at 65–68°F (18–20°C) — core temperature must drop ~1°F to initiate sleep.',
      'Avoid caffeine after 2 pm; its half-life is 5–7 hours.',
    ],
  },
  sleepConsistency: {
    icon: '🕐',
    headline: 'Lock in your sleep schedule',
    why: 'Irregular sleep timing is independently linked to 20–48% higher all-cause mortality, separate from duration.',
    steps: [
      'Same bedtime and wake time every day — within a 30-min window, 7 days a week.',
      'Anchor your wake time first; it\'s easier to shift than bedtime.',
      'Use bright light (ideally sunlight) within 30 min of waking — this is the strongest circadian zeitgeber.',
      'Dim lights and avoid alcohol 2 hrs before bed; both fragment sleep architecture even if total time looks fine.',
    ],
  },
  hrZone13MinPerWeek: {
    icon: '🚴',
    headline: 'Build your aerobic base (zone 1–3)',
    why: 'WHO guidelines: 150 min/wk moderate cardio cuts mortality risk ~20–30%. Most people are far below this.',
    steps: [
      'Target 150–200 min/wk of zone 1–3 (you can hold a conversation, HR ~50–70% max).',
      'Cycling, swimming, brisk walking, rowing — all count. Variety reduces injury risk.',
      'Stack it: 30 min × 5 days is easier to maintain than 90 min × 2.',
      'Use Apple Watch zone display. Zone 2 feels "comfortably hard" — you can speak but not sing.',
    ],
  },
  hrZone45MinPerWeek: {
    icon: '🔥',
    headline: 'Add high-intensity cardio (zone 4–5)',
    why: 'Vigorous exercise (≥75 min/wk) reduces mortality risk ~35%. Each 10 min adds ~4% risk reduction independently of moderate activity.',
    steps: [
      'Aim for 75–120 min/wk of zone 4–5 (hard effort, HR ~80–95% max, can\'t hold a conversation).',
      'HIIT 2× per week is the most time-efficient: 20–30 min sessions give outsized cardio benefit.',
      'Run, spin, row, or circuit training at max sustainable pace for intervals of 1–4 min.',
      'Allow 48 hrs between hard sessions — adaptation happens during recovery, not during the session.',
    ],
  },
  strengthMinPerWeek: {
    icon: '🏋️',
    headline: 'Add resistance training',
    why: 'Just 30–60 min/wk of strength work reduces mortality risk 10–17%, independent of cardio. Muscle mass is metabolic armour.',
    steps: [
      'Aim for 2–3 sessions/week, 30–45 min each. Compound lifts (squat, deadlift, press, row) give the most return.',
      'Progressive overload: add a small amount of weight or a rep each session — this is what drives adaptation.',
      'Protein timing matters: 0.7–1g per lb of bodyweight daily, with ~30–40g per meal to maximise muscle protein synthesis.',
      'Muscle mass peaks at ~30 and declines ~1%/yr after — every year you wait costs more to recover.',
    ],
  },
  leanBodyMassPct: {
    icon: '💪',
    headline: 'Increase lean body mass',
    why: 'Low muscle mass (sarcopenia) independently predicts mortality. More muscle = better glucose control, stronger bones, higher metabolic rate.',
    steps: [
      'Strength train 2–3× per week with progressive overload — the primary driver of muscle gain.',
      'Eat enough protein: 0.7–1g per lb bodyweight. Most people chronically under-eat protein.',
      'Don\'t chronically under-eat — muscle can\'t grow in a large caloric deficit.',
      'Track with your Apple Watch scale integration or a DEXA scan annually for accurate lean mass data.',
    ],
  },
};

function RecCard({ c, rec }) {
  return (
    <div className="rec-card">
      <div className="rec-header">
        <span className="rec-icon">{rec.icon}</span>
        <div className="rec-header-text">
          <div className="rec-headline">{rec.headline}</div>
          <div className="rec-cost">costing you +{fmt(c.delta, 1)} years</div>
        </div>
      </div>
      <p className="rec-why">{rec.why}</p>
      <ul className="rec-steps">
        {rec.steps.map((s, i) => (
          <li key={i} className="rec-step">{s}</li>
        ))}
      </ul>
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
