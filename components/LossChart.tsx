// 학습이 진행되면서 오차(RMSE, 점)가 줄어드는 곡선
export default function LossChart({ history, height = 90 }: { history: number[]; height?: number }) {
  if (history.length < 2) return null;
  const w = 300;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const span = Math.max(max - min, 0.001);
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * w},${6 + (1 - (v - min) / span) * (height - 12)}`).join(' ');
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`학습 오차가 ${history[0].toFixed(1)}점에서 ${history[history.length - 1].toFixed(1)}점으로 줄어들었어요`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#ff7aa0" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>처음 오차 {history[0].toFixed(1)}점</span>
        <span>지금 {history[history.length - 1].toFixed(1)}점</span>
      </figcaption>
    </figure>
  );
}
