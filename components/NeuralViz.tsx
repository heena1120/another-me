import { FEATURE_META, type NeuralTrace } from '@/lib/twin-model';

const W = 420;
const H = 330;
const X = [96, 195, 290, 380]; // 입력, 은닉1, 은닉2, 출력 열의 x 좌표
const SHORT = ['수면', '취침흔들림', '걸음', '운동', '카페인', '오후카페인', '물', '식사규칙', '숏폼', '자기전화면', '야외', '앉은날'];

/** 내 습관을 신경망에 넣었을 때 노드가 켜지는 정도와 영향이 큰 연결을 그립니다. (실제 계산 결과) */
export default function NeuralViz({ trace }: { trace: NeuralTrace }) {
  const pos = (l: number, i: number) => {
    const n = trace.layers[l].length;
    return { x: X[l], y: n === 1 ? H / 2 : 22 + (i * (H - 44)) / (n - 1) };
  };
  return (
    <svg className="neural" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="신경망: 내 습관 12개가 두 개의 은닉층을 지나 예상 컨디션 하나로 계산되는 모습">
      <g strokeLinecap="round">
        {trace.edges.map((e, k) => {
          const a = pos(e.l, e.i);
          const b = pos(e.l + 1, e.o);
          const s = Math.abs(e.v);
          return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.v >= 0 ? '#ff5c8a' : '#5aa0ff'} strokeOpacity={0.1 + 0.7 * s} strokeWidth={0.5 + 1.6 * s} />;
        })}
      </g>
      {trace.layers.map((layer, l) =>
        layer.map((v, i) => {
          const p = pos(l, i);
          const out = l === trace.layers.length - 1;
          return (
            <circle key={`${l}-${i}`} className={out ? 'out-node' : 'node'} style={{ animationDelay: `${(l * 0.25 + i * 0.05).toFixed(2)}s` }} cx={p.x} cy={p.y} r={out ? 15 : l === 0 ? 7 : 6} fill={out ? '#ff5c8a' : '#ffffff'} stroke="#5a4545" strokeWidth={out ? 3 : 2} fillOpacity={out ? 1 : 0.15 + 0.85 * v} />
          );
        }),
      )}
      {SHORT.slice(0, FEATURE_META.length).map((label, i) => {
        const p = pos(0, i);
        return (
          <text key={label} x={p.x - 13} y={p.y + 3.5} textAnchor="end" fontSize={10} fill="#6b5a5a">
            {label}
          </text>
        );
      })}
      <text x={X[3]} y={H / 2 + 34} textAnchor="middle" fontSize={10} fill="#6b5a5a">예상 컨디션</text>
    </svg>
  );
}
