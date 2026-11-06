// 영역별 점수 레이더 (축 4개). 점수는 0~100.
export default function Radar({ items }: { items: { label: string; score: number }[] }) {
  const cx = 130;
  const cy = 118;
  const R = 78;
  const n = items.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => `${(cx + Math.cos(angle(i)) * R * v).toFixed(1)},${(cy + Math.sin(angle(i)) * R * v).toFixed(1)}`;
  const ring = (v: number) => items.map((_, i) => pt(i, v)).join(' ');
  const poly = items.map((it, i) => pt(i, Math.max(0.04, Math.min(1, it.score / 100)))).join(' ');
  const label = items.map(i => `${i.label} ${Math.round(i.score)}%`).join(', ');
  return (
    <svg className="radar" viewBox="0 0 260 236" role="img" aria-label={`영역별 점수: ${label}`}>
      {[0.25, 0.5, 0.75, 1].map(v => (
        <polygon key={v} points={ring(v)} fill={v === 1 ? '#faf8ff' : 'none'} stroke="#e4def5" strokeWidth={1} />
      ))}
      {items.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle(i)) * R} y2={cy + Math.sin(angle(i)) * R} stroke="#e4def5" strokeWidth={1} />
      ))}
      <polygon points={poly} fill="#8b7bff" fillOpacity={0.22} stroke="#8b7bff" strokeWidth={2.5} strokeLinejoin="round" />
      {items.map((it, i) => {
        const [x, y] = pt(i, Math.max(0.04, Math.min(1, it.score / 100))).split(',').map(Number);
        return <circle key={it.label} cx={x} cy={y} r={4.5} fill="#fff" stroke="#8b7bff" strokeWidth={2.5} />;
      })}
      {items.map((it, i) => {
        const a = angle(i);
        const c = Math.cos(a);
        const lx = cx + c * (R + (Math.abs(c) > 0.3 ? 12 : 22));
        const ly = cy + Math.sin(a) * (R + 22);
        const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
        return (
          <text key={it.label} x={lx} y={ly + 4} textAnchor={anchor} fontSize={12} fontWeight={700} fill="#2a2540">
            {it.label}
          </text>
        );
      })}
    </svg>
  );
}
