/**
 * WHOOP-style Biological Age Calculator
 *
 * Methodology (per the WHOOP 2025 Healthspan White Paper):
 *  - Each metric maps to a published hazard ratio (HR) for all-cause mortality
 *  - Translate HR to effective years via the Gompertz relation:
 *       years_delta = 10 × ln(HR)
 *    (mortality doubles every ~7-8 years → ~10%/year rise → c ≈ 0.10)
 *  - Positive delta = aging you (higher mortality risk)
 *  - Negative delta = younger (lower mortality risk)
 *  - Sum deltas across the 9 metrics (SEM-corrected in WHOOP; here approximated
 *    by moderate weight reductions on overlapping cardio metrics)
 *
 * References embedded below.
 *
 * NOT medical advice. Consumer-grade estimate.
 */

// Map HR → years of effective aging
function hrToYears(hr) {
  if (hr <= 0 || !isFinite(hr)) return 0;
  return 10 * Math.log(hr);
}

// Linearly interpolate a metric value to a hazard ratio
function interpHR(value, points) {
  // points: [[v1, hr1], [v2, hr2], ...] sorted ascending by value
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [v1, h1] = points[i];
    const [v2, h2] = points[i + 1];
    if (value >= v1 && value <= v2) {
      // Log-linear interpolation of HR
      const t = (value - v1) / (v2 - v1);
      return Math.exp(Math.log(h1) + t * (Math.log(h2) - Math.log(h1)));
    }
  }
  return 1;
}

// ============================================
// VO2 Max — strongest longevity predictor
// References: Mandsager et al. JAMA 2018; Kokkinos et al. 2023
// Each 1-MET (3.5 mL/kg/min) improvement → HR ≈ 0.85
// Age- and sex-stratified "good" thresholds (ACSM)
// ============================================
function vo2HR(vo2, age, sex) {
  if (vo2 == null) return null;
  const isMale = sex === 'HKBiologicalSexMale' || sex === 'male';
  const a = age || 35;

  // Age/sex-adjusted reference (50th percentile "good" fitness)
  let ref;
  if (isMale) {
    if (a < 30) ref = 42;
    else if (a < 40) ref = 40;
    else if (a < 50) ref = 36;
    else if (a < 60) ref = 32;
    else ref = 28;
  } else {
    if (a < 30) ref = 35;
    else if (a < 40) ref = 33;
    else if (a < 50) ref = 30;
    else if (a < 60) ref = 27;
    else ref = 24;
  }

  // Each 1-MET (3.5 mL/kg/min) above ref → HR × 0.85
  //                      below ref → HR × 1.18
  const metsDelta = (vo2 - ref) / 3.5;
  const hr = metsDelta >= 0
    ? Math.pow(0.85, metsDelta)
    : Math.pow(1.18, -metsDelta);
  return clamp(hr, 0.55, 1.9);
}

// ============================================
// Resting Heart Rate
// Reference: Nauman et al. 2011 — each +10 bpm RHR → HR ≈ 1.09
// WHOOP neutral: <60 male, <64 female
// ============================================
function rhrHR(rhr, sex) {
  if (rhr == null) return null;
  const isMale = sex === 'HKBiologicalSexMale' || sex === 'male';
  const baseline = isMale ? 60 : 64;
  const bpmDelta = rhr - baseline;
  const hr = Math.pow(1.09, bpmDelta / 10);
  return clamp(hr, 0.7, 1.6);
}

// ============================================
// Daily Steps
// Reference: Paluch et al. 2022 Lancet — ~6% lower all-cause mortality per 1000 steps/day
// Diminishing returns above 10K; plateau ~12K
// ============================================
function stepsHR(steps, age) {
  if (steps == null) return null;
  const baseline = (age || 35) >= 60 ? 5600 : 8000;
  if (steps >= 12000) return 0.75; // plateau
  const deltaThousands = (steps - baseline) / 1000;
  const hr = Math.pow(0.94, deltaThousands);
  return clamp(hr, 0.72, 1.5);
}

// ============================================
// Sleep Duration
// Reference: Hirshkowitz et al. 2015, Dashti et al. 2019 — U-shape
// ~7-8 hrs optimal; <6 or >9 → HR rises
// ============================================
function sleepDurationHR(hours) {
  if (hours == null) return null;
  return interpHR(hours, [
    [4.0, 1.35],
    [5.0, 1.20],
    [6.0, 1.08],
    [7.0, 1.00],
    [8.0, 0.94],
    [9.0, 1.04],
    [10.0, 1.20],
  ]);
}

// ============================================
// Sleep Consistency
// Reference: Windred et al. 2023 Sleep — top quintile regularity had 20-48% lower all-cause mortality
// WHOOP neutral: ≥70%
// ============================================
function sleepConsistencyHR(pct) {
  if (pct == null) return null;
  return interpHR(pct, [
    [30, 1.30],
    [50, 1.15],
    [70, 1.00],
    [85, 0.88],
    [95, 0.78],
  ]);
}

// ============================================
// HR Zone 1-3 Cardio (moderate)
// Reference: WHO 150 min/wk moderate → HR ≈ 0.80 vs inactive
// WHOOP neutral target: ~100 min/week (young)
// ============================================
function zone13HR(minPerWeek) {
  if (minPerWeek == null) return null;
  return interpHR(minPerWeek, [
    [0, 1.22],
    [30, 1.10],
    [70, 1.00],
    [100, 0.95],
    [150, 0.85],
    [300, 0.78],
  ]);
}

// ============================================
// HR Zone 4-5 Cardio (vigorous)
// Reference: WHO 75 min/wk vigorous. Each 10 min vigorous → HR ≈ 0.96
// WHOOP neutral: ~10 min/week (young)
// ============================================
function zone45HR(minPerWeek) {
  if (minPerWeek == null) return null;
  return interpHR(minPerWeek, [
    [0, 1.12],
    [5, 1.05],
    [10, 1.00],
    [30, 0.92],
    [60, 0.85],
    [120, 0.80],
  ]);
}

// ============================================
// Strength Training
// Reference: Momma et al. 2022 BJSM — 30-60 min/wk strength training → HR ≈ 0.85-0.90
// WHOOP optimal: 40+ min/wk (30-120 range); >120 no added benefit
// ============================================
function strengthHR(minPerWeek) {
  if (minPerWeek == null) return null;
  return interpHR(minPerWeek, [
    [0, 1.15],
    [15, 1.05],
    [30, 0.95],
    [60, 0.88],
    [120, 0.85],
    [180, 0.88], // slight rebound per Momma et al.
  ]);
}

// ============================================
// Lean Body Mass Percentage
// Reference: Srikanthan & Karlamangla 2014 AJM — sarcopenia/muscle mass ↔ mortality
// WHOOP young adult target: >67% F, >80% M
// ============================================
function leanBodyMassHR(pct, sex) {
  if (pct == null) return null;
  const isMale = sex === 'HKBiologicalSexMale' || sex === 'male';
  const target = isMale ? 80 : 67;
  // Each 5% below target → HR ≈ 1.15
  const delta = (pct - target) / 5;
  const hr = delta >= 0
    ? Math.pow(0.94, delta)
    : Math.pow(1.15, -delta);
  return clamp(hr, 0.85, 1.5);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================
// Main calculation
// ============================================
export function calculateBioAge(parsedData) {
  const { metrics, chronologicalAge, biologicalSex } = parsedData;
  const age = chronologicalAge;

  // Build contribution for each metric that has data
  const defs = [
    {
      key: 'vo2max',
      name: 'VO2 Max',
      value: metrics.vo2max.value,
      unit: 'mL/kg/min',
      weight: 1.0, // full weight — the single strongest predictor
      // Apple Watch underestimates lab VO2 Max by ~5–15% (Passler 2019, Bhammar 2020).
      // Apply a conservative 1.10 correction before comparing against lab-calibrated
      // ACSM / Mandsager thresholds so the hazard ratio reflects true fitness.
      hr: vo2HR(
        metrics.vo2max.value != null ? metrics.vo2max.value * 1.10 : null,
        age,
        biologicalSex
      ),
      context: 'Cardiorespiratory fitness — strongest longevity predictor',
    },
    {
      key: 'rhr',
      name: 'Resting Heart Rate',
      value: metrics.rhr.value,
      unit: 'bpm',
      weight: 0.6, // partially overlaps with VO2 — downweight (SEM adj.)
      hr: rhrHR(metrics.rhr.value, biologicalSex),
      context: 'Cardiac efficiency marker',
    },
    {
      key: 'steps',
      name: 'Daily Steps',
      value: metrics.steps.value,
      unit: 'steps/day',
      weight: 0.8,
      hr: stepsHR(metrics.steps.value, age),
      context: 'Everyday non-exercise activity',
    },
    {
      key: 'sleepDuration',
      name: 'Sleep Duration',
      value: metrics.sleepDuration.value,
      unit: 'hrs',
      weight: 0.9,
      hr: sleepDurationHR(metrics.sleepDuration.value),
      context: 'Nightly sleep hours',
    },
    {
      key: 'sleepConsistency',
      name: 'Sleep Consistency',
      value: metrics.sleepConsistency.value,
      unit: '%',
      weight: 0.7,
      hr: sleepConsistencyHR(metrics.sleepConsistency.value),
      context: 'Regularity of bed/wake times',
    },
    {
      key: 'hrZone13MinPerWeek',
      name: 'Zone 1–3 Cardio',
      value: metrics.hrZone13MinPerWeek?.value,
      unit: 'min/wk',
      weight: 0.7,
      hr: zone13HR(metrics.hrZone13MinPerWeek?.value),
      context: 'Low–moderate intensity cardio minutes',
    },
    {
      key: 'hrZone45MinPerWeek',
      name: 'Zone 4–5 Cardio',
      value: metrics.hrZone45MinPerWeek?.value,
      unit: 'min/wk',
      weight: 0.8,
      hr: zone45HR(metrics.hrZone45MinPerWeek?.value),
      context: 'Vigorous intensity cardio minutes',
    },
    {
      key: 'strengthMinPerWeek',
      name: 'Strength Training',
      value: metrics.strengthMinPerWeek?.value,
      unit: 'min/wk',
      weight: 0.8,
      hr: strengthHR(metrics.strengthMinPerWeek?.value),
      context: 'Resistance training — preserves lean mass & bone density',
    },
    {
      key: 'leanBodyMassPct',
      name: 'Lean Body Mass',
      value: metrics.leanBodyMassPct?.value,
      unit: '%',
      weight: 0.6,
      hr: leanBodyMassHR(metrics.leanBodyMassPct?.value, biologicalSex),
      context: 'Muscle mass vs total body mass — needs scale or manual entry',
    },
  ];

  const contributions = defs
    .filter(d => d.value != null && d.hr != null && isFinite(d.hr))
    .map(d => {
      const years = hrToYears(d.hr) * d.weight;
      return {
        name: d.name,
        metric: d.key,
        value: d.value,
        unit: d.unit,
        hr: d.hr,
        delta: years,
        weight: d.weight,
        description: describeDelta(d.name, years, d.context),
      };
    });

  // Total years added (sum of weighted contributions)
  const totalDelta = contributions.reduce((s, c) => s + c.delta, 0);

  // Data completeness: how many of the 9 metrics we have
  const dataCompleteness = contributions.length / defs.length;

  const biologicalAge = age != null ? age + totalDelta : null;
  const diff = totalDelta;

  // Pace of Aging — compares recent 30d VO2 trend vs 6mo baseline
  const paceOfAging = computePaceOfAging(parsedData.trends);

  // Health score: 0–100 scale
  // 75 baseline, each year better adds 4, each year worse subtracts 4
  const healthScore = clamp(75 - totalDelta * 4, 0, 100);

  return {
    biologicalAge,
    chronologicalAge: age,
    diff,
    healthScore,
    paceOfAging,
    contributions: contributions.sort((a, b) => b.delta - a.delta), // worst first
    dataCompleteness,
    missingMetrics: defs.filter(d => d.value == null).map(d => d.name),
  };
}

function describeDelta(name, years, context) {
  if (Math.abs(years) < 0.3) return `Neutral — ${context}`;
  if (years < -1.5) return `Major win — ${context}`;
  if (years < 0) return `Helping — ${context}`;
  if (years < 1.5) return `Slightly aging you — ${context}`;
  return `Big age cost — ${context}`;
}

function computePaceOfAging(trends) {
  if (!trends || !trends.vo2max || trends.vo2max.length < 2) return null;

  const recent = trends.vo2max[trends.vo2max.length - 1];
  const older = trends.vo2max[0];

  if (!recent.avg || !older.avg) return null;

  // Expected natural decline: ~0.5 mL/kg/min per year ≈ 0.25 in 6 months
  const expectedChange = -0.25;
  const actualChange = recent.avg - older.avg;
  const surplus = actualChange - expectedChange;

  // Map: surplus of +3 mL/kg/min (strong improvement) → 0x (not aging)
  //      surplus of 0 → 1x (calendar pace)
  //      surplus of -3 (rapid decline) → 3x
  const pace = clamp(1 - surplus / 3, -1, 3);

  return {
    pace: pace.toFixed(2),
    direction: surplus > 0.5 ? 'improving' : surplus < -0.5 ? 'declining' : 'stable',
    vo2Change: actualChange,
  };
}
