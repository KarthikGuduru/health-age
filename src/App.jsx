import { useState } from 'react';
import Nav from './components/Nav';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import AgeGate from './components/AgeGate';
import { parseHealthExport } from './utils/parseHealthData';
import { calculateBioAge } from './utils/calculateBioAge';
import './App.css';

function App() {
  const [status, setStatus] = useState('idle'); // idle | parsing | needs-age | done | error
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus('parsing');
    setError(null);
    try {
      const parsed = await parseHealthExport(file, setProgress);
      if (parsed.chronologicalAge == null) {
        // DOB not found in export — ask the user
        setParsedData(parsed);
        setStatus('needs-age');
      } else {
        const bioAge = calculateBioAge(parsed);
        setResult({ parsed, bioAge });
        setStatus('done');
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Something went wrong');
      setStatus('error');
    }
  };

  const handleAgeSubmit = (age) => {
    const patched = { ...parsedData, chronologicalAge: age };
    const bioAge = calculateBioAge(patched);
    setResult({ parsed: patched, bioAge });
    setStatus('done');
  };

  const handleReset = () => {
    setStatus('idle');
    setResult(null);
    setParsedData(null);
    setError(null);
    setProgress('');
  };

  return (
    <>
      <Nav onReset={handleReset} hasResult={status === 'done'} />
      {status === 'done' && result ? (
        <Dashboard result={result} />
      ) : status === 'needs-age' ? (
        <AgeGate onSubmit={handleAgeSubmit} />
      ) : (
        <Landing
          onFile={handleFile}
          status={status}
          progress={progress}
          error={error}
        />
      )}
    </>
  );
}

export default App;
