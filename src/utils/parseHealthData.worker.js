import { unzipSync } from 'fflate';

const RECORD_TYPES = {
  rhr: 'HKQuantityTypeIdentifierRestingHeartRate',
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  vo2max: 'HKQuantityTypeIdentifierVO2Max',
  spo2: 'HKQuantityTypeIdentifierOxygenSaturation',
  respiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  height: 'HKQuantityTypeIdentifierHeight',
  walkingHRAvg: 'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  walkingSpeed: 'HKQuantityTypeIdentifierWalkingSpeed',
  walkingStepLength: 'HKQuantityTypeIdentifierWalkingStepLength',
  walkingAsymmetry: 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage',
  walkingDoubleSupportPct: 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage',
  cardioFitness: 'HKQuantityTypeIdentifierAppleWalkingSteadiness',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis',
  leanBodyMass: 'HKQuantityTypeIdentifierLeanBodyMass',
  bodyFatPct: 'HKQuantityTypeIdentifierBodyFatPercentage',
};

// Reverse lookup (identifier → key) for fast matching
const TYPE_TO_KEY = {};
for (const [key, id] of Object.entries(RECORD_TYPES)) {
  TYPE_TO_KEY[id] = key;
}

function parseDate(str) {
  if (!str) return new Date(NaN);
  // Apple Health dates: "2024-01-15 07:32:45 -0700"
  // Safari requires ISO 8601: "2024-01-15T07:32:45-07:00"
  const iso = str
    .replace(' ', 'T')                              // space → T
    .replace(/ ([+-])(\d{2})(\d{2})$/, '$1$2:$3'); // -0700 → -07:00
  return new Date(iso);
}

// ============================================
// Streaming parser — works on an async iterator
// of string chunks. Keeps a rolling buffer so
// records that straddle chunk boundaries aren't
// dropped. Never holds the whole XML in memory.
// ============================================

async function parseStream(chunkIterator, onProgress) {
  const records = {};
  for (const key of Object.keys(RECORD_TYPES)) {
    records[key] = [];
  }
  records.activitySummaries = [];
  records.workouts = [];
  records.userInfo = { dateOfBirth: null, biologicalSex: null };

  // Global regexes — used with exec() + lastIndex walking across the buffer.
  // We add lastIndex bookkeeping so we can safely trim the processed portion.
  const recordRe = /<Record\s+([^>]+)\/>/g;
  const activityRe = /<ActivitySummary\s+([^>]+)\/>/g;
  // Workouts: flat form OR with nested children closing </Workout>
  const workoutFlatRe = /<Workout\s+([^>]+)\/>/g;
  const workoutBlockRe = /<Workout\s+([^>]*?)>[\s\S]*?<\/Workout>/g;
  // Apple Health XML: <Me HKCharacteristicTypeIdentifierDateOfBirth="1990-03-15" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" .../>
  const dobRe = /HKCharacteristicTypeIdentifierDateOfBirth="([^"]+)"/;
  const sexRe = /HKCharacteristicTypeIdentifierBiologicalSex="([^"]+)"/;

  let buffer = '';
  let totalBytes = 0;
  let recordCount = 0;
  let lastProgress = 0;

  let sawDOB = false;
  let sawSex = false;

  for await (const chunk of chunkIterator) {
    buffer += chunk;
    totalBytes += chunk.length;

    // One-off metadata at the top of the file
    if (!sawDOB) {
      const m = buffer.match(dobRe);
      if (m) { records.userInfo.dateOfBirth = m[1]; sawDOB = true; }
    }
    if (!sawSex) {
      const m = buffer.match(sexRe);
      if (m) { records.userInfo.biologicalSex = m[1]; sawSex = true; }
    }

    // Find the safe cut point: the last fully-closed element boundary.
    // Everything before it has been fully received and can be processed.
    // Everything after it is kept for the next chunk.
    const cutAt = findSafeCut(buffer);
    if (cutAt <= 0) {
      // No complete element yet — keep waiting for more data
      if (buffer.length > 16 * 1024 * 1024) {
        // Pathological case — trim from the front to avoid runaway
        buffer = buffer.slice(buffer.length - 8 * 1024 * 1024);
      }
      continue;
    }

    const slice = buffer.slice(0, cutAt);
    buffer = buffer.slice(cutAt);

    // Process records in the slice (each regex walks the slice once)
    let match;
    recordRe.lastIndex = 0;
    while ((match = recordRe.exec(slice)) !== null) {
      recordCount++;
      const attrs = match[1];
      const typeM = attrs.match(/type="([^"]+)"/);
      if (typeM) {
        const key = TYPE_TO_KEY[typeM[1]];
        if (key) {
          const valueM = attrs.match(/value="([^"]+)"/);
          const startM = attrs.match(/startDate="([^"]+)"/);
          const endM = attrs.match(/endDate="([^"]+)"/);
          if (startM) {
            const entry = { date: startM[1], endDate: endM ? endM[1] : null };
            if (valueM) {
              entry.value = key === 'sleepAnalysis' ? valueM[1] : parseFloat(valueM[1]);
            }
            records[key].push(entry);
          }
        }
      }
    }

    activityRe.lastIndex = 0;
    while ((match = activityRe.exec(slice)) !== null) {
      const attrs = match[1];
      const dateM = attrs.match(/dateComponents="([^"]+)"/);
      if (dateM) {
        const moveM = attrs.match(/activeEnergyBurned="([^"]+)"/);
        const exM = attrs.match(/appleExerciseTime="([^"]+)"/);
        const standM = attrs.match(/appleStandHours="([^"]+)"/);
        const goalM = attrs.match(/activeEnergyBurnedGoal="([^"]+)"/);
        records.activitySummaries.push({
          date: dateM[1],
          activeEnergy: moveM ? parseFloat(moveM[1]) : 0,
          exerciseMinutes: exM ? parseFloat(exM[1]) : 0,
          standHours: standM ? parseFloat(standM[1]) : 0,
          moveGoal: goalM ? parseFloat(goalM[1]) : 0,
        });
      }
    }

    workoutBlockRe.lastIndex = 0;
    while ((match = workoutBlockRe.exec(slice)) !== null) {
      addWorkout(records.workouts, match[1]);
    }
    workoutFlatRe.lastIndex = 0;
    while ((match = workoutFlatRe.exec(slice)) !== null) {
      addWorkout(records.workouts, match[1]);
    }

    // Progress update — throttled to avoid flooding React
    const now = Date.now();
    if (onProgress && now - lastProgress > 250) {
      lastProgress = now;
      onProgress(
        `Parsing… ${(totalBytes / 1024 / 1024).toFixed(0)} MB · ${(recordCount / 1000).toFixed(0)}k records`
      );
      // Yield to the event loop so React can repaint
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Final sweep of the remaining tail (no trimming now)
  recordRe.lastIndex = 0;
  let m;
  while ((m = recordRe.exec(buffer)) !== null) {
    recordCount++;
    const attrs = m[1];
    const typeM = attrs.match(/type="([^"]+)"/);
    if (typeM) {
      const key = TYPE_TO_KEY[typeM[1]];
      if (key) {
        const valueM = attrs.match(/value="([^"]+)"/);
        const startM = attrs.match(/startDate="([^"]+)"/);
        const endM = attrs.match(/endDate="([^"]+)"/);
        if (startM) {
          const entry = { date: startM[1], endDate: endM ? endM[1] : null };
          if (valueM) {
            entry.value = key === 'sleepAnalysis' ? valueM[1] : parseFloat(valueM[1]);
          }
          records[key].push(entry);
        }
      }
    }
  }

  return records;
}

// Return the index after the last complete element boundary in the buffer.
// Safe cut points: after '/>' (self-closed) or after '</Workout>' (block).
// Returns 0 if no complete element found yet.
function findSafeCut(buffer) {
  const lastSelfClose = buffer.lastIndexOf('/>');
  const lastWorkoutClose = buffer.lastIndexOf('</Workout>');
  const a = lastSelfClose >= 0 ? lastSelfClose + 2 : -1;
  const b = lastWorkoutClose >= 0 ? lastWorkoutClose + 10 : -1;
  return Math.max(a, b, 0);
}

function addWorkout(arr, attrs) {
  const typeM = attrs.match(/workoutActivityType="([^"]+)"/);
  const durM = attrs.match(/duration="([^"]+)"/);
  const unitM = attrs.match(/durationUnit="([^"]+)"/);
  const startM = attrs.match(/startDate="([^"]+)"/);
  const endM = attrs.match(/endDate="([^"]+)"/);

  if (!startM || !typeM) return;
  let durationMin = durM ? parseFloat(durM[1]) : 0;
  if (unitM && unitM[1] === 'sec') durationMin /= 60;
  else if (unitM && unitM[1] === 'hr') durationMin *= 60;

  arr.push({
    type: typeM[1],
    duration: durationMin,
    date: startM[1],
    endDate: endM ? endM[1] : null,
  });
}

// ============================================
// Chunk iterators for different input types
// ============================================

async function* iterateFileStream(file) {
  const decoder = new TextDecoder('utf-8');
  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const tail = decoder.decode();
      if (tail) yield tail;
      return;
    }
    yield decoder.decode(value, { stream: true });
  }
}

// Unzip the export.zip in the worker (off main thread) using fflate's
// synchronous unzipSync with a filter so only export.xml is decompressed.
// Then stream the decompressed Uint8Array in 256 KB text chunks.
async function* iterateZipFromFile(file, onProgress) {
  onProgress?.('Reading zip into memory…');
  const buffer = await file.arrayBuffer();

  onProgress?.('Decompressing export.xml…');
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => f.name.endsWith('export.xml'),
    });
  } catch (err) {
    throw new Error(`Zip decompression failed: ${err.message}. Try uploading the export.xml file directly.`);
  }

  const xmlKey = Object.keys(files).find((k) => k.endsWith('export.xml'));
  if (!xmlKey) {
    throw new Error('export.xml not found in zip. Unzip the file and upload export.xml directly.');
  }

  const xmlData = files[xmlKey]; // Uint8Array of the full decompressed XML
  const decoder = new TextDecoder('utf-8');
  const CHUNK = 256 * 1024; // 256 KB

  for (let i = 0; i < xmlData.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, xmlData.length);
    const isFinal = end >= xmlData.length;
    yield decoder.decode(xmlData.subarray(i, end), { stream: !isFinal });
    onProgress?.(`Parsing… ${(end / 1024 / 1024).toFixed(0)} MB`);
    // Yield to event loop so progress messages can be posted
    await new Promise((r) => setTimeout(r, 0));
  }

  const tail = decoder.decode();
  if (tail) yield tail;
}

// ============================================
// Public entry point
// ============================================

async function parseHealthExport(file, onProgress) {
  let iterator;

  if (file.name.endsWith('.zip')) {
    if (onProgress) onProgress('Opening zip archive…');
    iterator = iterateZipFromFile(file, onProgress);
  } else {
    iterator = iterateFileStream(file);
  }

  if (onProgress) onProgress('Streaming export…');
  const records = await parseStream(iterator, onProgress);

  if (onProgress) onProgress('Computing metrics…');
  return processRecords(records);
}

// ============================================
// Post-processing (unchanged from before)
// ============================================

// Apple workout activity types classified as strength/resistance training
const STRENGTH_WORKOUT_TYPES = new Set([
  'HKWorkoutActivityTypeTraditionalStrengthTraining',
  'HKWorkoutActivityTypeFunctionalStrengthTraining',
  'HKWorkoutActivityTypeCrossTraining',
  'HKWorkoutActivityTypeCoreTraining',
  'HKWorkoutActivityTypeHighIntensityIntervalTraining',
  'HKWorkoutActivityTypeKickboxing',
  'HKWorkoutActivityTypeClimbing',
]);

function processRecords(records) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const getRecent = (arr, days = 30) => {
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
    return arr
      .filter(r => parseDate(r.date) >= cutoff && !isNaN(r.value))
      .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  };

  const avg = (arr) => {
    if (!arr.length) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  };

  // Core metrics
  const recentRHR = getRecent(records.rhr, 30);
  const recentHRV = getRecent(records.hrv, 30);
  const recentVO2 = getRecent(records.vo2max, 90);
  const recentSpO2 = getRecent(records.spo2, 30);
  const recentRR = getRecent(records.respiratoryRate, 30);
  const recentWalkHR = getRecent(records.walkingHRAvg, 30);

  const rhrAvg = avg(recentRHR.map(r => r.value));
  const hrvAvg = avg(recentHRV.map(r => r.value));
  const vo2Avg = avg(recentVO2.map(r => r.value));
  const spo2Avg = avg(recentSpO2.map(r => r.value));
  const rrAvg = avg(recentRR.map(r => r.value));
  const walkHRAvg = avg(recentWalkHR.map(r => r.value));

  // Sleep
  const sleepData = computeSleepMetrics(records.sleepAnalysis, 30);

  // Activity
  const recentActivity = records.activitySummaries.filter(
    a => parseDate(a.date) >= thirtyDaysAgo
  );
  const avgExerciseMin = avg(recentActivity.map(a => a.exerciseMinutes));
  const avgStandHours = avg(recentActivity.map(a => a.standHours));
  const ringsClosedPct = recentActivity.length
    ? recentActivity.filter(a => a.activeEnergy >= a.moveGoal && a.moveGoal > 0).length / recentActivity.length
    : null;

  // Steps (daily aggregation)
  const recentSteps = aggregateDaily(records.stepCount, 30);
  const avgSteps = avg(Object.values(recentSteps));

  // Body
  const recentWeight = getRecent(records.bodyMass, 90);
  const recentHeight = getRecent(records.height, 365);
  const weight = recentWeight.length ? recentWeight[0].value : null;
  const height = recentHeight.length ? recentHeight[0].value : null;
  const bmi = weight && height ? weight / (height * height) : null;

  // Lean body mass %
  const recentLBM = getRecent(records.leanBodyMass || [], 90);
  const recentBF = getRecent(records.bodyFatPct || [], 90);
  let leanBodyMassPct = null;
  if (recentLBM.length && weight) {
    leanBodyMassPct = (recentLBM[0].value / weight) * 100;
  } else if (recentBF.length) {
    leanBodyMassPct = (1 - recentBF[0].value) * 100;
  }

  // Chronological age
  let chronologicalAge = null;
  if (records.userInfo.dateOfBirth) {
    const dob = parseDate(records.userInfo.dateOfBirth);
    chronologicalAge = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
  }

  // HR zones + strength
  const maxHR = chronologicalAge ? 220 - chronologicalAge : 185;
  const zoneData = computeHRZones(records.heartRate, records.workouts, rhrAvg || 65, maxHR, 30);

  const recentWorkouts = records.workouts.filter(
    w => parseDate(w.date) >= thirtyDaysAgo
  );
  const strengthMinTotal = recentWorkouts
    .filter(w => STRENGTH_WORKOUT_TYPES.has(w.type))
    .reduce((s, w) => s + (w.duration || 0), 0);
  const strengthMinPerWeek = strengthMinTotal * (7 / 30);

  const trends = computeTrends(records);

  const metrics = {
    rhr: { value: rhrAvg, unit: 'bpm', label: 'Resting Heart Rate', count: recentRHR.length },
    hrv: { value: hrvAvg, unit: 'ms', label: 'Heart Rate Variability', count: recentHRV.length },
    vo2max: { value: vo2Avg, unit: 'mL/kg/min', label: 'VO2 Max', count: recentVO2.length },
    spo2: { value: spo2Avg ? spo2Avg * 100 : null, unit: '%', label: 'Blood Oxygen', count: recentSpO2.length },
    respiratoryRate: { value: rrAvg, unit: 'br/min', label: 'Respiratory Rate', count: recentRR.length },
    walkingHR: { value: walkHRAvg, unit: 'bpm', label: 'Walking Heart Rate', count: recentWalkHR.length },
    sleepDuration: { value: sleepData.avgDuration, unit: 'hrs', label: 'Avg Sleep Duration', count: sleepData.nightCount },
    sleepConsistency: { value: sleepData.consistency, unit: '%', label: 'Sleep Consistency', count: sleepData.nightCount },
    exerciseMinutes: { value: avgExerciseMin, unit: 'min/day', label: 'Exercise Minutes', count: recentActivity.length },
    standHours: { value: avgStandHours, unit: 'hrs/day', label: 'Stand Hours', count: recentActivity.length },
    steps: { value: avgSteps, unit: 'steps/day', label: 'Daily Steps', count: Object.keys(recentSteps).length },
    bmi: { value: bmi, unit: 'kg/m²', label: 'BMI', count: recentWeight.length },
    ringsClosedPct: { value: ringsClosedPct ? ringsClosedPct * 100 : null, unit: '%', label: 'Move Ring Closed', count: recentActivity.length },
    // WHOOP-aligned
    hrZone13MinPerWeek: { value: zoneData.zone13MinPerWeek, unit: 'min/wk', label: 'Zone 1–3 Cardio', count: zoneData.workoutDays },
    hrZone45MinPerWeek: { value: zoneData.zone45MinPerWeek, unit: 'min/wk', label: 'Zone 4–5 Cardio', count: zoneData.workoutDays },
    strengthMinPerWeek: { value: strengthMinPerWeek, unit: 'min/wk', label: 'Strength Training', count: recentWorkouts.length },
    leanBodyMassPct: { value: leanBodyMassPct, unit: '%', label: 'Lean Body Mass', count: (recentLBM.length + recentBF.length) },
  };

  return {
    metrics,
    chronologicalAge,
    biologicalSex: records.userInfo.biologicalSex,
    trends,
    rawCounts: {
      totalRecords: Object.values(records).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0),
    },
  };
}

function computeSleepMetrics(sleepRecords, days) {
  const now = new Date();
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);

  const asleepValues = ['HKCategoryValueSleepAnalysisAsleepCore',
    'HKCategoryValueSleepAnalysisAsleepDeep',
    'HKCategoryValueSleepAnalysisAsleepREM',
    'HKCategoryValueSleepAnalysisAsleep',
    'HKCategoryValueSleepAnalysisAsleepUnspecified'];

  const recentSleep = sleepRecords.filter(
    r => parseDate(r.date) >= cutoff && asleepValues.includes(r.value)
  );

  const nights = {};
  for (const r of recentSleep) {
    const start = parseDate(r.date);
    const end = r.endDate ? parseDate(r.endDate) : start;
    const duration = (end - start) / (1000 * 60 * 60);
    if (duration <= 0 || duration > 24) continue;

    const nightDate = start.getHours() < 18
      ? new Date(start - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : start.toISOString().slice(0, 10);

    if (!nights[nightDate]) nights[nightDate] = 0;
    nights[nightDate] += duration;
  }

  const durations = Object.values(nights).filter(d => d >= 2 && d <= 16);
  const avgDuration = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;

  let consistency = null;
  if (durations.length >= 7) {
    const mean = avgDuration;
    const variance = durations.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    consistency = Math.max(0, Math.min(100, (1 - stdDev / 3) * 100));
  }

  return { avgDuration, consistency, nightCount: durations.length };
}

function aggregateDaily(records, days) {
  const now = new Date();
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
  const daily = {};
  for (const r of records) {
    const d = parseDate(r.date);
    if (d < cutoff || isNaN(r.value)) continue;
    const key = d.toISOString().slice(0, 10);
    if (!daily[key]) daily[key] = 0;
    daily[key] += r.value;
  }
  return daily;
}

function computeHRZones(heartRateRecords, workouts, rhr, maxHR, days) {
  const now = new Date();
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
  const hrr = maxHR - rhr;
  const zone4Threshold = rhr + 0.7 * hrr;

  const recentWorkouts = workouts.filter(w => parseDate(w.date) >= cutoff);
  const recentHR = heartRateRecords.filter(r => parseDate(r.date) >= cutoff);

  let zone13Min = 0;
  let zone45Min = 0;
  const workoutDays = new Set();

  for (const w of recentWorkouts) {
    const ws = parseDate(w.date);
    const we = w.endDate ? parseDate(w.endDate) : new Date(ws.getTime() + (w.duration || 0) * 60000);
    workoutDays.add(ws.toISOString().slice(0, 10));

    const samplesInWorkout = recentHR.filter(r => {
      const t = parseDate(r.date);
      return t >= ws && t <= we;
    });

    if (samplesInWorkout.length === 0) {
      zone13Min += (w.duration || 0);
      continue;
    }
    const durPerSample = (w.duration || 0) / samplesInWorkout.length;
    for (const s of samplesInWorkout) {
      if (s.value >= zone4Threshold) zone45Min += durPerSample;
      else zone13Min += durPerSample;
    }
  }

  return {
    zone13MinPerWeek: zone13Min * (7 / days),
    zone45MinPerWeek: zone45Min * (7 / days),
    workoutDays: workoutDays.size,
  };
}

function computeTrends(records) {
  const now = new Date();
  const periods = [
    { label: '6 months ago', start: new Date(now - 210 * 86400000), end: new Date(now - 150 * 86400000) },
    { label: '3 months ago', start: new Date(now - 120 * 86400000), end: new Date(now - 60 * 86400000) },
    { label: 'Recent', start: new Date(now - 30 * 86400000), end: now },
  ];

  const trendMetrics = ['rhr', 'hrv', 'vo2max'];
  const trends = {};

  for (const metric of trendMetrics) {
    if (!records[metric]) continue;
    trends[metric] = periods.map(p => {
      const vals = records[metric]
        .filter(r => {
          const d = parseDate(r.date);
          return d >= p.start && d <= p.end && !isNaN(r.value);
        })
        .map(r => r.value);
      return {
        label: p.label,
        avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
        count: vals.length,
      };
    });
  }

  return trends;
}

// ============================================
// Web Worker message bindings
// ============================================

self.onmessage = async (e) => {
  const { file } = e.data;
  try {
    const result = await parseHealthExport(file, (msg) => {
      self.postMessage({ type: 'progress', data: msg });
    });
    self.postMessage({ type: 'done', data: result });
  } catch (err) {
    self.postMessage({
      type: 'error',
      data: err?.message || String(err),
    });
  }
};
