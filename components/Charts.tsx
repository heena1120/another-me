const W = 300;
const H = 110;

/** 한 습관을 바꿔 갈 때 예상 컨디션이 어떻게 변하는지(모델이 찾은 패턴 곡선). 현재 값에 점을 찍습니다. */
export function CurveChart({ points, current, label }: { points: { x: number; y: number }[]; current: number; label: string }) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 8 + ((x - x0) / (x1 - x0 || 1)) * (W - 16);
  const sy = (y: number) => 10 + (1 - (y - y0) / (y1 - y0 || 1)) * (H - 24);
  const path = points.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const cur = points.reduce((a, b) => (Math.abs(b.x - current) < Math.abs(a.x - current) ? b : a));
  const best = points.reduce((a, b) => (b.y > a.y ? b : a));
  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <polyline points={path} fill="none" stroke="#ff7aa0" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(best.x)} cy={sy(best.y)} r={5} fill="#ffd35c" stroke="#5a4545" strokeWidth={2} />
      <line x1={sx(cur.x)} y1={6} x2={sx(cur.x)} y2={H - 14} stroke="#5a4545" strokeDasharray="3 3" strokeWidth={1.5} />
      <circle cx={sx(cur.x)} cy={sy(cur.y)} r={5.5} fill="#fff" stroke="#5a4545" strokeWidth={2.5} />
      <text x={8} y={H - 2} fontSize={9} fill="#8a7a7a">{x0}</text>
      <text x={W - 8} y={H - 2} fontSize={9} fill="#8a7a7a" textAnchor="end">{x1}</text>
    </svg>
  );
}

/** 쌍둥이가 미리 예측한 값과 실제 컨디션의 비교 */
export function SeriesChart({ rows }: { rows: { actual: number; predicted: number | null }[] }) {
  const n = rows.length;
  const sx = (i: number) => 14 + (n === 1 ? 0.5 : i / (n - 1)) * (W - 28);
  const sy = (v: number) => 8 + (1 - v / 100) * (H - 16);
  const line = (get: (r: (typeof rows)[number]) => number | null) =>
    rows
      .map((r, i) => ({ i, v: get(r) }))
      .filter((p): p is { i: number; v: number } => p.v !== null)
      .map(p => `${sx(p.i).toFixed(1)},${sy(p.v).toFixed(1)}`)
      .join(' ');
  return (
    <figure className="chart">
      <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="실제 컨디션과 쌍둥이가 미리 예측한 컨디션 비교">
        <polyline points={line(r => r.predicted)} fill="none" stroke="#5aa0ff" strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={line(r => r.actual)} fill="none" stroke="#ff5c8a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((r, i) => (
          <circle key={i} cx={sx(i)} cy={sy(r.actual)} r={3.5} fill="#ff5c8a" />
        ))}
      </svg>
      <figcaption>
        <span><i className="dot pink" /> 실제</span>
        <span><i className="dot blue" /> 쌍둥이의 사전 예측</span>
      </figcaption>
    </figure>
  );
}

/**
 * 0~60개월 동안 두 미래의 컨디션 지수 변화. 선택한 시점에 세로선을 그립니다.
 * 새 습관은 첫 몇 달에 가장 크게 변하므로, 시간축은 앞쪽이 넓게 보이도록(제곱근) 그립니다.
 */
export function TrajectoryChart({ traj, month }: { traj: { month: number; now: number; improved: number }[]; month: number }) {
  const sx = (m: number) => 12 + Math.sqrt(m / 60) * (W - 24);
  const all = traj.flatMap(t => [t.now, t.improved]);
  const lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...all) + 6) / 10) * 10);
  const sy = (v: number) => 8 + (1 - (v - lo) / Math.max(hi - lo, 1)) * (H - 26);
  const pts = (k: 'now' | 'improved') => traj.map(t => `${sx(t.month).toFixed(1)},${sy(t[k]).toFixed(1)}`);
  const area = [...pts('improved'), ...pts('now').reverse()].join(' ');
  const cur = traj[Math.min(60, Math.max(0, Math.round(month)))];
  const ticks: [number, string][] = [[0, '지금'], [3, '3개월'], [12, '1년'], [36, '3년'], [60, '5년']];
  return (
    <figure className="chart">
      <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="5년 동안 두 미래의 컨디션 지수 변화">
        <polygon points={area} fill="#ff5c8a" fillOpacity={0.14} />
        <polyline points={pts('now').join(' ')} fill="none" stroke="#9aa3b5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pts('improved').join(' ')} fill="none" stroke="#ff5c8a" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={sx(cur.month)} y1={4} x2={sx(cur.month)} y2={H - 16} stroke="#5a4545" strokeDasharray="3 3" strokeWidth={1.5} />
        <circle cx={sx(cur.month)} cy={sy(cur.now)} r={5} fill="#fff" stroke="#9aa3b5" strokeWidth={2.5} />
        <circle cx={sx(cur.month)} cy={sy(cur.improved)} r={5.5} fill="#fff" stroke="#ff5c8a" strokeWidth={2.5} />
        {ticks.map(([m, label]) => (
          <text key={m} x={sx(m)} y={H - 3} fontSize={9} fill="#8a7a7a" textAnchor={m === 0 ? 'start' : m === 60 ? 'end' : 'middle'}>
            {label}
          </text>
        ))}
      </svg>
    </figure>
  );
}
