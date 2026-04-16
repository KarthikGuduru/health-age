import { useState } from 'react';
import './AgeGate.css';

export default function AgeGate({ onSubmit }) {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');

  const valid = age >= 18 && age <= 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit(Number(age));
  };

  return (
    <main className="age-gate">
      <div className="age-gate-card">
        <div className="age-gate-icon">👤</div>
        <h2 className="age-gate-title">One quick thing</h2>
        <p className="age-gate-body">
          Your date of birth wasn't found in the export.
          We need your age to calculate how far your biological age
          is from your calendar age.
        </p>

        <form className="age-gate-form" onSubmit={handleSubmit}>
          <div className="age-gate-field">
            <label className="age-gate-label" htmlFor="age-input">
              Your age
            </label>
            <input
              id="age-input"
              className="age-gate-input"
              type="number"
              min="18"
              max="100"
              placeholder="e.g. 31"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn-primary age-gate-btn"
            disabled={!valid}
          >
            Calculate my biological age
          </button>
        </form>
      </div>
    </main>
  );
}
