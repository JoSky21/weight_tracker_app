import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

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
const types = ['Walking', 'Jogging', 'Swimming', 'Taekwondo', 'Bodyweight', 'Other'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [date, setDate] = useState(today());
  const [type, setType] = useState('Walking');
  const [minutes, setMinutes] = useState('30');
  const [distance, setDistance] = useState('');
  const [exertion, setExertion] = useState('4');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);
  useEffect(() => {
    if (!user) { setWorkouts([]); return; }
    const q = query(collection(db, 'users', user.uid, 'workouts'), orderBy('date', 'desc'));
    return onSnapshot(q, snapshot => {
      setWorkouts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Workout)));
    }, e => setError(`Unable to load workouts: ${e.message}`));
  }, [user]);
  const totalMinutes = useMemo(() => {
    const current = new Date();
    const monday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const start = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    return workouts.filter(w => w.date >= start).reduce((n,w) => n+w.minutes, 0);
  }, [workouts]);

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
  if (!authReady) return <main className="shell"><p>Checking sign-in…</p></main>;
  if (!user) return <main className="shell"><div className="panel auth"><p className="eyebrow">KEEP MOVING</p><h1>Your fitness journey</h1><p className="muted">Private workout log. One session at a time.</p><form onSubmit={login}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label><button disabled={busy}>Sign in</button></form>{error && <p className="error" role="alert">{error}</p>}<p className="small muted">Create your one account in Firebase Authentication first. This app has no public registration.</p></div></main>;
  return <main className="shell"><header><div><p className="eyebrow">KEEP MOVING</p><h1>Fitness Tracker</h1><p className="muted">Consistency over intensity.</p></div><button className="secondary" onClick={()=>signOut(auth)}>Sign out</button></header>
    <section className="metrics"><div className="panel"><div className="muted">This week's movement</div><strong>{totalMinutes} min</strong><div className="muted small">A rest day is part of the plan.</div></div><div className="panel"><div className="muted">Workouts recorded</div><strong>{workouts.length}</strong><div className="muted small">Every manageable session counts.</div></div></section>
    <section className="panel"><h2>Log a workout</h2><form onSubmit={save} className="form-grid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label><label>Activity<select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></label><label>Minutes<input type="number" min="1" max="1440" value={minutes} onChange={e=>setMinutes(e.target.value)} required /></label><label>Distance (miles, optional)<input type="number" step="0.01" min="0" value={distance} onChange={e=>setDistance(e.target.value)} /></label><label>Effort (1 = easy, 10 = maximal)<input type="range" min="1" max="10" value={exertion} onChange={e=>setExertion(e.target.value)} /> <span>{exertion}/10</span></label><label className="full">Notes<textarea rows={3} placeholder="Breathing, calves, recovery, how it felt…" value={notes} onChange={e=>setNotes(e.target.value)} /></label><button disabled={busy}>Save workout</button></form>{error && <p className="error" role="alert">{error}</p>}</section>
    <section className="panel"><h2>Workout history</h2>{workouts.length===0 ? <p className="muted">No workouts yet. Your first entry will appear here on both devices.</p> : <div className="entries">{workouts.map(w=><article className="entry" key={w.id}><div><strong>{w.type}</strong><div className="muted small">{w.date} · {w.minutes} min{w.distanceMiles != null ? ` · ${w.distanceMiles} mi` : ''} · effort {w.exertion ?? '—'}/10</div>{w.notes && <p>{w.notes}</p>}</div></article>)}</div>}</section>
    <footer>Progress means returning, not pushing to exhaustion.</footer></main>;
}
