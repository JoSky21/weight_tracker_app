import { useEffect, useMemo, useRef, useState } from 'react';

export type WeightPoint = {
  id: string;
  date: string; // YYYY-MM-DD, stored in Firestore as a string
  weightLb: number;
};

type Range = '30' | '90' | 'all';

function localDay(iso: string): Date {
  // Noon avoids shifting the displayed calendar date in some time zones.
  return new Date(`${iso}T12:00:00`);
}

function dateLabel(iso: string): string {
  return localDay(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function WeightChart({ records, goalLb = 210 }: { records: WeightPoint[]; goalLb?: number }) {
  const [range, setRange] = useState<Range>('30');
  const holderRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const observer = new ResizeObserver(entries => {
      const next = Math.floor(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(holder);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(12, 0, 0, 0);
    if (range !== 'all') cutoff.setDate(cutoff.getDate() - (Number(range) - 1));
    const cutoffStr = isoDate(cutoff);
    return records
      .filter(r => Number.isFinite(r.weightLb) && (range === 'all' || r.date >= cutoffStr))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, range]);

  const height = 270;
  const left = 46, right = 18, top = 20, bottom = 39;
  const plotW = Math.max(1, width - left - right);
  const plotH = height - top - bottom;
  const values = points.map(p => p.weightLb);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const pad = points.length ? Math.max(2, (maxValue - minValue) * 0.22) : 2;
  const yMin = Math.floor(minValue - pad);
  const yMax = Math.ceil(maxValue + pad);
  const firstTime = points.length ? localDay(points[0].date).getTime() : 0;
  const lastTime = points.length ? localDay(points[points.length - 1].date).getTime() : 0;
  const xFor = (date: string) => lastTime === firstTime
    ? left + plotW / 2
    : left + (localDay(date).getTime() - firstTime) / (lastTime - firstTime) * plotW;
  const yFor = (weight: number) => top + (yMax - weight) / (yMax - yMin) * plotH;
  const coords = points.map(p => [xFor(p.date), yFor(p.weightLb)] as const);
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPoints = coords.length >= 2
    ? `${coords[0][0]},${top + plotH} ${linePoints} ${coords[coords.length - 1][0]},${top + plotH}`
    : '';
  const startDate = points[0]?.date;
  const midDate = points[Math.floor((points.length - 1) / 2)]?.date;
  const endDate = points[points.length - 1]?.date;
  const dateTicks = [...new Set([startDate, midDate, endDate].filter((d): d is string => !!d))];

  return (
    <div className="chart-module">
      <div className="chart-title-row">
        <div>
          <h3>Weight trend</h3>
          <p className="muted small chart-subtitle">Based only on your saved weigh-ins.</p>
        </div>
        <div className="range-controls" role="group" aria-label="Weight chart date range">
          {([['30', '30 days'], ['90', '90 days'], ['all', 'All']] as const).map(([id, label]) => (
            <button type="button" className={`range-button ${range === id ? 'active' : ''}`}
              aria-pressed={range === id} onClick={() => setRange(id)} key={id}>{label}</button>
          ))}
        </div>
      </div>
      <div className="chart-holder" ref={holderRef}>
        {points.length === 0 ? (
          <div className="chart-empty">No weigh-ins in this range yet. Log a weight above or choose another time range.</div>
        ) : (
          <svg className="weight-svg" viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={`Weight progress chart with ${points.length} measurements, from ${dateLabel(points[0].date)} to ${dateLabel(points[points.length - 1].date)}`}>
            <title>Weight progress</title>
            <defs>
              <linearGradient id="weight-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#168675" stopOpacity="0.19" />
                <stop offset="100%" stopColor="#168675" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {Array.from({ length: 5 }, (_, i) => {
              const value = yMax - (yMax - yMin) * i / 4;
              const y = yFor(value);
              return <g key={i}>
                <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e0eae5" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#647f79">
                  {Number(value.toFixed(1))}
                </text>
              </g>;
            })}
            {goalLb >= yMin && goalLb <= yMax && (
              <g>
                <line x1={left} x2={width - right} y1={yFor(goalLb)} y2={yFor(goalLb)}
                  stroke="#d18c45" strokeWidth="1.5" strokeDasharray="5 5" />
                <text x={width - right - 2} y={yFor(goalLb) - 6} fontSize="11"
                  textAnchor="end" fill="#955d23">{goalLb} lb goal</text>
              </g>
            )}
            {areaPoints && <polygon points={areaPoints} fill="url(#weight-area-gradient)" />}
            {points.length > 1 && <polyline points={linePoints} fill="none"
              stroke="#147e6e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
            {coords.map(([x, y], i) => (
              <circle key={points[i].id} cx={x} cy={y} r="4.5" stroke="#fff" strokeWidth="2"
                fill="#147e6e"><title>{dateLabel(points[i].date)}: {points[i].weightLb.toFixed(1)} lb</title></circle>
            ))}
            {dateTicks.map((date, i) => {
              const x = xFor(date);
              return <text key={date} x={x} y={height - 12} fontSize="12" fill="#647f79"
                textAnchor={dateTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === dateTicks.length - 1 ? 'end' : 'middle'}>
                {dateLabel(date)}
              </text>;
            })}
          </svg>
        )}
      </div>
      {points.length === 1 && <p className="muted small">Add another weigh-in on a different date to see the trend line.</p>}
    </div>
  );
}
