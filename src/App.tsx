import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import WeightChart, { type WeightPoint } from './WeightChart';

type Workout = {
  id: string;
  date: string;
  type: string;
  minutes: number;
  distanceMiles?: number;
  exertion?: number;
  notes?: string;
  createdAt?: Timestamp;
};
type WeightEntry = WeightPoint & { notes?: string; createdAt?: Timestamp };
type Tab = 'workouts' | 'weight';

const STARTING_REFERENCE_LB = 235;
const FIRST_GOAL_LB = 210;
const LONG_TERM_GOAL_LB = 180;
const types = ['Walking', 'Jogging', 'Swimming', 'Taekwondo', 'Bodyweight', 'Other'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const formatLb = (value: number) => `${value.toFixed(1)} lb`;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('workouts');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);

  // Existing workout form state is intentionally retained.
  const [date, setDate] = useState(today());
  const [type, setType] = useState('Walking');
  const [minutes, setMinutes] = useState('30');
  const [distance, setDistance] = useState('');
  const [exertion, setExertion] = useState('4');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // New weight form state.
  const [weightDate, setWeightDate] = useState(today());
  const [weightLb, setWeightLb] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [weightBusy, setWeightBusy] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [weightNotice, setWeightNotice] = useState('');

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);
  useEffect(() => {
    if (!user) { setWorkouts([]); return; }
    const q = query(collection(db, 'users', user.uid, 'workouts'), orderBy('date', 'desc'));
    return onSnapshot(q, snapshot => {
      setWorkouts(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Workout)));
    }, e => setError(`Unable to load workouts: ${e.message}`));
  }, [user]);
  useEffect(() => {
    if (!user) { setWeights([]); return; }
    // This new collection lives alongside your original workouts in the same account.
    const q = query(collection(db, 'users', user.uid, 'weights'), orderBy('date', 'desc'));
    return onSnapshot(q, snapshot => {
      setWeights(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as WeightEntry)));
    }, e => setWeightError(`Unable to load weigh-ins: ${e.message}`));
  }, [user]);

  const totalMinutes = useMemo(() => {
    const current = new Date();
    const monday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const start = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    return workouts.filter(w => w.date >= start).reduce((n,w) => n+w.minutes, 0);
  }, [workouts]);

  const latest = weights[0]; // Query is sorted by date descending.
  const oldest = weights[weights.length - 1];
  const changeFromFirst = latest && oldest && latest.id !== oldest.id ? latest.weightLb - oldest.weightLb : null;
  const weekAverage = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const start = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
    const recent = weights.filter(w => w.date >= start && w.date <= today());
    return recent.length ? recent.reduce((sum, w) => sum + w.weightLb, 0) / recent.length : null;
  }, [weights]);
  const milestoneProgress = latest ? Math.min(100, Math.max(0,
    (STARTING_REFERENCE_LB - latest.weightLb) / (STARTING_REFERENCE_LB - FIRST_GOAL_LB) * 100
  )) : 0;

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await signInWithEmailAndPassword(auth, email, password); setPassword(''); }
    catch(e) { setError(e instanceof Error ? e.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    setError(''); setBusy(true);
    try {
      const duration = Number(minutes);
      if (!(duration > 0 && duration <= 1440)) throw new Error('Enter a duration between 1 and 1440 minutes.');
      const dist = distance.trim() ? Number(distance) : undefined;
      if (dist !== undefined && !(dist >= 0 && Number.isFinite(dist))) throw new Error('Enter a valid distance.');
      await addDoc(collection(db, 'users', user.uid, 'workouts'), {
        date, type, minutes: duration, ...(dist !== undefined ? { distanceMiles: dist } : {}),
        exertion: Number(exertion), notes: notes.trim(), createdAt: serverTimestamp()
      });
      setDistance(''); setNotes('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }
  async function saveWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    setWeightError(''); setWeightNotice(''); setWeightBusy(true);
    try {
      const value = Number(weightLb);
      if (weightLb.trim() === '' || !Number.isFinite(value) || value < 50 || value > 1000) {
        throw new Error('Enter a weight between 50 and 1000 lb.');
      }
      if (!weightDate || weightDate > today()) throw new Error('Select today or a past date.');
      await addDoc(collection(db, 'users', user.uid, 'weights'), {
        date: weightDate,
        weightLb: Math.round(value * 10) / 10,
        notes: weightNotes.trim(),
        createdAt: serverTimestamp()
      });
      setWeightLb(''); setWeightNotes('');
      setWeightNotice('Weigh-in saved and synced.');
    } catch(e) { setWeightError(e instanceof Error ? e.message : 'Unable to save weight.'); }
    finally { setWeightBusy(false); }
  }
  async function removeWeight(record: WeightEntry) {
    if (!user || !window.confirm(`Delete your ${record.date} weigh-in (${formatLb(record.weightLb)})? This cannot be undone.`)) return;
    setWeightError(''); setWeightNotice(''); setWeightBusy(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'weights', record.id));
      setWeightNotice('Weigh-in deleted.');
    } catch(e) { setWeightError(e instanceof Error ? e.message : 'Unable to delete weigh-in.'); }
    finally { setWeightBusy(false); }
  }

  if (!authReady) return <main className="shell"><p>Checking sign-in…</p></main>;
  if (!user) return <main className="shell"><div className="panel auth"><p className="eyebrow">KEEP MOVING</p><h1>Your fitness journey</h1><p className="muted">Private workout log. One session at a time.</p><form onSubmit={login}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label><button disabled={busy}>Sign in</button></form>{error && <p className="error" role="alert">{error}</p>}<p className="small muted">Create your one account in Firebase Authentication first. This app has no public registration.</p></div></main>;

  return <main className="shell">
    <header><div><p className="eyebrow">KEEP MOVING</p><h1>Fitness Tracker</h1><p className="muted">Consistency over intensity.</p></div><button className="secondary" onClick={()=>signOut(auth)}>Sign out</button></header>

    <nav className="tab-bar" aria-label="Tracker sections" role="tablist">
      <button type="button" className={`tab-button ${tab === 'workouts' ? 'selected' : ''}`}
        role="tab" id="workouts-tab" aria-controls="workouts-panel" aria-selected={tab === 'workouts'}
        onClick={() => setTab('workouts')}>Workouts</button>
      <button type="button" className={`tab-button ${tab === 'weight' ? 'selected' : ''}`}
        role="tab" id="weight-tab" aria-controls="weight-panel" aria-selected={tab === 'weight'}
        onClick={() => setTab('weight')}>Weight &amp; Progress</button>
    </nav>

    {tab === 'workouts' ? <div role="tabpanel" id="workouts-panel" aria-labelledby="workouts-tab">
      <section className="metrics"><div className="panel"><div className="muted">This week's movement</div><strong>{totalMinutes} min</strong><div className="muted small">A rest day is part of the plan.</div></div><div className="panel"><div className="muted">Workouts recorded</div><strong>{workouts.length}</strong><div className="muted small">Every manageable session counts.</div></div></section>
      <section className="panel"><h2>Log a workout</h2><form onSubmit={save} className="form-grid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label><label>Activity<select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></label><label>Minutes<input type="number" min="1" max="1440" value={minutes} onChange={e=>setMinutes(e.target.value)} required /></label><label>Distance (miles, optional)<input type="number" step="0.01" min="0" value={distance} onChange={e=>setDistance(e.target.value)} /></label><label>Effort (1 = easy, 10 = maximal)<input type="range" min="1" max="10" value={exertion} onChange={e=>setExertion(e.target.value)} /> <span>{exertion}/10</span></label><label className="full">Notes<textarea rows={3} placeholder="Breathing, calves, recovery, how it felt…" value={notes} onChange={e=>setNotes(e.target.value)} /></label><button disabled={busy}>Save workout</button></form>{error && <p className="error" role="alert">{error}</p>}</section>
      <section className="panel"><h2>Workout history</h2>{workouts.length===0 ? <p className="muted">No workouts yet. Your first entry will appear here on both devices.</p> : <div className="entries">{workouts.map(w=><article className="entry" key={w.id}><div><strong>{w.type}</strong><div className="muted small">{w.date} · {w.minutes} min{w.distanceMiles != null ? ` · ${w.distanceMiles} mi` : ''} · effort {w.exertion ?? '—'}/10</div>{w.notes && <p>{w.notes}</p>}</div></article>)}</div>}</section>
    </div> : <div role="tabpanel" id="weight-panel" aria-labelledby="weight-tab">
      <section className="weight-intro">
        <p className="eyebrow">ONE STEP AT A TIME</p>
        <h2>Weight &amp; Progress</h2>
        <p className="muted">Track your longer-term trend, not day-to-day fluctuations.</p>
      </section>
      <section className="weight-metrics" aria-label="Weight summary">
        <div className="panel metric-tile"><div className="muted small">Latest weigh-in</div><strong>{latest ? formatLb(latest.weightLb) : '—'}</strong><div className="muted small">{latest?.date ?? 'No entries yet'}</div></div>
        <div className="panel metric-tile"><div className="muted small">7-day average</div><strong>{weekAverage !== null ? formatLb(weekAverage) : '—'}</strong><div className="muted small">Recorded measurements</div></div>
        <div className="panel metric-tile"><div className="muted small">Change since first log</div><strong>{changeFromFirst === null ? '—' : `${changeFromFirst > 0 ? '+' : ''}${changeFromFirst.toFixed(1)} lb`}</strong><div className="muted small">{oldest && latest && oldest.id !== latest.id ? `${oldest.date} to ${latest.date}` : 'Needs two weigh-ins'}</div></div>
      </section>
      <section className="panel"><div className="goal-heading"><div><h2>First milestone: {FIRST_GOAL_LB} lb</h2><p className="muted small">Starting reference: {STARTING_REFERENCE_LB} lb · Longer-term goal: {LONG_TERM_GOAL_LB} lb</p></div><strong className="goal-percent">{latest ? `${Math.round(milestoneProgress)}%` : '—'}</strong></div>
        <div className="goal-track" role="progressbar" aria-label="Progress toward first weight goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(milestoneProgress)}><div className="goal-fill" style={{width: `${milestoneProgress}%`}} /></div>
        <p className="muted small goal-note">{latest ? latest.weightLb <= FIRST_GOAL_LB ? 'You reached your first milestone. Keep focusing on sustainable habits.' : `${Math.max(0, latest.weightLb - FIRST_GOAL_LB).toFixed(1)} lb to your first milestone.` : 'Save your first weigh-in to start tracking progress.'}</p>
      </section>
      <section className="panel"><h2>Log a weigh-in</h2><form className="form-grid" onSubmit={saveWeight}>
        <label>Date<input type="date" value={weightDate} max={today()} onChange={e => setWeightDate(e.target.value)} required /></label>
        <label>Weight (lb)<input type="number" inputMode="decimal" min="50" max="1000" step="0.1" placeholder="e.g. 235.0" value={weightLb} onChange={e => setWeightLb(e.target.value)} required /></label>
        <label className="full">Notes (optional)<textarea rows={2} placeholder="Anything you'd like to remember…" value={weightNotes} onChange={e => setWeightNotes(e.target.value)} /></label>
        <button disabled={weightBusy}>Save weight</button>
      </form>{weightError && <p className="error" role="alert">{weightError}</p>}{weightNotice && <p className="notice" role="status">{weightNotice}</p>}</section>
      <section className="panel"><WeightChart records={weights} goalLb={FIRST_GOAL_LB}/></section>
      <section className="panel"><h2>Weigh-in history</h2>{weights.length === 0 ? <p className="muted">No weigh-ins yet. Your entries will sync between your phone and laptop.</p> : <div className="entries">{weights.map(w => <article className="entry weight-entry" key={w.id}><div><strong>{formatLb(w.weightLb)}</strong><div className="muted small">{w.date}</div>{w.notes && <p>{w.notes}</p>}</div><button className="danger-link" type="button" disabled={weightBusy} aria-label={`Delete weigh-in from ${w.date}`} onClick={() => removeWeight(w)}>Delete</button></article>)}</div>}</section>
    </div>}
    <footer>Progress means returning, not pushing to exhaustion.</footer>
  </main>;
}
