// A/B 반복 평가: 실행 중인 서버(기본 http://localhost:3000)의 /api/ai/coach를 실제로 여러 번 호출해서
// "A와 B의 퀘스트가 정말 다른가, 근거가 검증되는가, 가장 낮은 영역을 다루는가"를 수치로 냅니다.
// 사용: npm run eval:ab -- [반복횟수=3] [서버주소]     (AI 호출 비용이 들고, 코치 API는 10분에 15회로 제한돼요)
import { buildCoachInput } from '../lib/ai-client.ts';
import { LEVER_AREA } from '../lib/ai-types.ts';
import { PERSONAS } from '../lib/demo.ts';
import { pretrain } from '../lib/twin-model.ts';
import { baselineFromProfile } from '../lib/twin-data.ts';

const N = Math.max(1, Math.min(7, Number(process.argv[2]) || 3));
const BASE = process.argv[3] || 'http://localhost:3000';

const { model } = await pretrain({ epochs: 40 });
const runs = { A: [], B: [] };

for (const id of ['A', 'B']) {
  const profile = PERSONAS[id].profile;
  const input = buildCoachInput({ mode: 'initial', profile, plans: {}, archived: [], model, baseHabits: baselineFromProfile(profile), today: '2026-01-01' });
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/ai/coach`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify(input) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.result) {
      console.log(`${id} #${i + 1} 실패: ${data.code ?? res.status} ${data.error ?? ''}`);
      runs[id].push({ ok: false });
      continue;
    }
    const q = data.result.quests;
    runs[id].push({
      ok: true,
      levers: q.map(x => x.lever),
      verified: q.filter(x => x.verified).length,
      total: q.length,
      minutes: q.reduce((s, x) => s + x.minutes, 0),
      covers: input.constraints?.mustCoverArea ? q.some(x => LEVER_AREA[x.lever] === input.constraints.mustCoverArea) : null,
      model: data.meta.model,
      ms: Date.now() - t0,
      adjustments: data.adjustments?.length ?? 0,
    });
    console.log(`${id} #${i + 1}: ${q.map(x => x.lever).join(', ')} (${runs[id].at(-1).ms}ms)`);
  }
}

const ok = id => runs[id].filter(r => r.ok);
const jacc = (x, y) => { const u = new Set([...x, ...y]); return u.size ? x.filter(v => y.includes(v)).length / u.size : 0; };
const pairs = [];
for (const a of ok('A')) for (const b of ok('B')) pairs.push(jacc(a.levers, b.levers));
const self = id => { const r = ok(id), v = []; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) v.push(jacc(r[i].levers, r[j].levers)); return v; };
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const f = v => (v === null ? '–' : v.toFixed(2));
const all = [...ok('A'), ...ok('B')];

console.log('\n── 결과 ──');
console.log(`성공 ${all.length}/${N * 2}회 · 모델: ${[...new Set(all.map(r => r.model))].join(', ') || '–'}`);
console.log(`A↔B 퀘스트 종류 겹침(0=완전 다름, 1=같음): 평균 ${f(mean(pairs))} (최대 ${pairs.length ? Math.max(...pairs).toFixed(2) : '–'})`);
console.log(`같은 사람 반복 간 겹침(일관성): A ${f(mean(self('A')))} · B ${f(mean(self('B')))}`);
console.log(`근거 검증 통과율: ${all.length ? ((all.reduce((s, r) => s + r.verified, 0) / all.reduce((s, r) => s + r.total, 0)) * 100).toFixed(0) : '–'}%`);
console.log(`가장 낮은 영역 퀘스트 포함: ${all.filter(r => r.covers).length}/${all.filter(r => r.covers !== null).length}`);
console.log(`평균 응답 ${all.length ? Math.round(mean(all.map(r => r.ms)) / 1000) : '–'}초 · 코드가 고친 부분 평균 ${f(mean(all.map(r => r.adjustments)))}건`);
