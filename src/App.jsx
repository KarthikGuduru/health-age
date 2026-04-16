import { useState } from 'react';
import Nav from './components/Nav';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import { parseHealthExport } from './utils/parseHealthData';
import { calculateBioAge } from './utils/calculateBioAge';
import './App.css';

function App() {
  const [status, setStatus] = useState('idle'); // idle | parsing | done | error
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus('parsing');
    setError(null);
    try {
      const parsed = await parseHealthExport(file, setProgress);
      const bioAge = calculateBioAge(parsed);
      setResult({ parsed, bioAge });
      setStatus('done');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Something went wrong');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setProgress('');
  };

  return (
    <>
      <Nav onReset={handleReset} hasResult={status === 'done'} />
      {status === 'done' && result ? (
        <Dashboard result={result} />
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
