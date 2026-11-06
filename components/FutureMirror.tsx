'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import FutureChat from '@/components/FutureChat';
import TwinStage from '@/components/TwinStage';
import { TrajectoryChart } from '@/components/Charts';
import { useAvatar } from '@/lib/avatar-store';
import { useAiEnabled } from '@/lib/use-ai-enabled';
import { predict } from '@/lib/twin-model';
import { improvedHabits, todayKey, whatIfRanking } from '@/lib/twin-data';
import { acceptProbs, closenessOf, completionRate, groupScores, idealRange, levelOfScore, missionStats, moodForVitality, residualStd, simulate5y, vitalityOf } from '@/lib/twin-sim';
import { useTwin } from '@/lib/use-twin';

const approx = (n: number) => Math.round(n / 10) * 10; // 시뮬레이션이라 일 수는 10일 단위로 보여 줍니다.
const when = (m: number) => (m === 0 ? '지금' : m === 60 ? '5년 뒤' : m % 12 === 0 ? `${m / 12}년 뒤` : `${m}개월 뒤`);
const pct = (c: number) => `${Math.round(c * 100)}%`;

export default function FutureMirror() {
  const avatar = useAvatar();
  const { state, model, baseHabits } = useTwin();
  const [month, setMonth] = useState(60);
  const [mode, setMode] = useState<'compare' | 'keep' | 'change'>('compare'); // FUTURE SWITCH
  const aiEnabled = useAiEnabled();

  const profile = state?.profile ?? null;
  const plans = state?.plans;
  const checkins = state?.checkins;

  // 내 실제 미션 달성률과 예측 오차로 계산합니다. 미션을 체크하면 이 값이 바뀌어 미래도 바로 바뀝니다.
  const calc = useMemo(() => {
    if (!profile || !model || !baseHabits || !plans || !checkins) return null;
    const today = todayKey();
    const ideal = idealRange(model);
    const accept = acceptProbs(missionStats(plans, today));
    const sim = simulate5y(model, profile, baseHabits, { adherence: completionRate(plans, today), sigma: residualStd(checkins), items: plans[today], accept });
    const ids = sim.items.map(i => i.id);
    const full = improvedHabits(profile, baseHabits, ids);
    const gNow = groupScores(model, baseHabits);
    const gFull = groupScores(model, full);
    const groups = gNow.map((g, i) => ({ label: g.label, now: g.score, full: gFull[i].score }));

    // "완벽한 나로 가는 길": 지금 미션을 모두 지킨 뒤에도 더 하면 좋은 습관을 효과 큰 순서로 더해 봅니다.
    const extras = whatIfRanking(model, profile, baseHabits, accept)
      .ranking.filter(r => !ids.includes(r.id) && r.gain >= 0.8)
      .slice(0, 3);
    const road: { label: string; close: number }[] = [];
    let cur = [...ids];
    for (const e of extras) {
      cur = [...cur, e.id];
      road.push({ label: e.title, close: closenessOf(predict(model, improvedHabits(profile, baseHabits, cur)), ideal) });
    }
    return {
      sim,
      ideal,
      road,
      groups,
      nowClose: closenessOf(sim.traj[0].now, ideal),
      keepClose: closenessOf(predict(model, improvedHabits(profile, baseHabits, ids)), ideal),
    };
  }, [profile, model, baseHabits, plans, checkins]);

  if (!state || !avatar) return <p className="muted" role="status">불러오는 중…</p>;
  if (!profile)
    return (
      <section className="card">
        <h2>5년 뒤의 나를 보려면</h2>
        <p className="muted">질문 몇 개(1분)면 돼요.</p>
        <Link className="btn primary" href="/interview">나 소개하기</Link>
      </section>
    );
  if (!calc) return <p className="muted" role="status">쌍둥이 신경망이 학습 중이에요. 홈에서 학습이 진행돼요.</p>;

  const { sim, ideal } = calc;
  const at = sim.traj[month];
  const end = sim.traj[60];
  const vNow = vitalityOf(at.now);
  const vImp = vitalityOf(at.improved);
  const endClose = closenessOf(end.improved, ideal);
  const nowClose = closenessOf(end.now, ideal);
  const endLv = levelOfScore(end.improved, ideal);
  const goodGain = approx(sim.days.improved.good - sim.days.now.good);
  const toughCut = approx(sim.days.now.tough - sim.days.improved.tough);

  return (
    <div className="stack">
      <section className="goal" aria-label="완벽한 나까지의 여정">
        <div className="goal-head">
          <span>🌟 완벽한 5년 뒤의 나</span>
          <strong>{pct(endClose)}</strong>
        </div>
        <div className="journey" role="img" aria-label={`지금 ${pct(nowClose)}, 미션을 지키면 5년 뒤 ${pct(endClose)}, 완벽한 나는 100%`}>
          <i className="j-now" style={{ width: pct(nowClose) }} />
          <i className="j-gain" style={{ left: pct(nowClose), width: `${Math.max(0, Math.round((endClose - nowClose) * 100))}%` }} />
          <b className="j-dot now" style={{ left: pct(nowClose) }} />
          <b className="j-dot goal5" style={{ left: pct(endClose) }} />
          <span className="j-end">👑</span>
        </div>
        <p className="goal-note">
          지금 습관 그대로면 <b>{pct(nowClose)}</b> → 미션을 지키면 5년 뒤 <b>{pct(endClose)}</b> (Lv.{endLv.level} {endLv.name})
        </p>
      </section>

      <div className="seg" role="group" aria-label="FUTURE SWITCH: 보고 싶은 미래">
        {([['compare', '비교'], ['keep', '습관 유지'], ['change', '행동 변화']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>

      <section className={mode === 'compare' ? 'mirror' : 'mirror single'} aria-label="미래 시나리오">
        {mode !== 'change' && (
          <div className="mirror-side">
            <span className="mirror-tag">현재 습관 유지</span>
            <TwinStage avatar={avatar} height={mode === 'compare' ? 230 : 300} vitality={vNow} mood={moodForVitality(vNow)} />
            <strong className="mirror-score">{pct(closenessOf(at.now, ideal))}</strong>
          </div>
        )}
        {mode !== 'keep' && (
          <div className="mirror-side good">
            <span className="mirror-tag">행동을 바꾸면</span>
            <TwinStage avatar={avatar} height={mode === 'compare' ? 230 : 300} vitality={vImp} mood={moodForVitality(vImp)} />
            <strong className="mirror-score">{pct(closenessOf(at.improved, ideal))}</strong>
          </div>
        )}
      </section>

      <section className="card time-card">
        <div className="card-head">
          <h2>{when(month)}</h2>
          <span className="points">완벽한 나까지</span>
        </div>
        <input type="range" min={0} max={60} step={1} value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="몇 개월 뒤의 모습을 볼까요" aria-valuetext={when(month)} />
        <div className="chips" role="group" aria-label="시점 바로가기">
          {[0, 12, 36, 60].map(m => (
            <button key={m} type="button" aria-pressed={month === m} className={`chip${month === m ? ' selected' : ''}`} onClick={() => setMonth(m)}>
              {m === 0 ? '지금' : `${m / 12}년`}
            </button>
          ))}
        </div>
        <TrajectoryChart traj={sim.traj} month={month} />
      </section>

      <section className="bignums" aria-label="5년 뒤 요약">
        <div className="up">
          <strong>+{Math.round((endClose - nowClose) * 100)}%p</strong>
          <small>완벽한 나에<br />더 가까워져요</small>
        </div>
        <div className="up">
          <strong>+{goodGain}일</strong>
          <small>컨디션 좋은 날<br />(약)</small>
        </div>
        <div className="up">
          <strong>−{toughCut}일</strong>
          <small>힘든 날<br />(약)</small>
        </div>
      </section>

      <section className="card" aria-label="두 미래의 차이">
        <h2>두 미래의 차이 (5년 뒤)</h2>
        <table className="compare">
          <thead>
            <tr><th scope="col">영역</th><th scope="col">습관 유지</th><th scope="col">행동 변화</th><th scope="col">차이</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>완벽한 나까지</td>
              <td>{pct(nowClose)}</td>
              <td>{pct(endClose)}</td>
              <td className="gain">+{Math.round((endClose - nowClose) * 100)}%p</td>
            </tr>
            {calc.groups.map(g => (
              <tr key={g.label}>
                <td>{g.label}</td>
                <td>{Math.round(g.now)}%</td>
                <td>{Math.round(g.full)}%</td>
                <td className="gain">{g.full - g.now >= 1 ? `+${Math.round(g.full - g.now)}%p` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">영역 점수는 이상적인 습관 대비 %이고, 행동 변화는 오늘의 퀘스트를 모두 지켰을 때예요.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>이 퀘스트들로 가요</h2>
          <Link className="points" href="/quests">오늘 퀘스트 하러 가기</Link>
        </div>
        <div className="chips">
          {sim.items.length > 0 ? sim.items.map(i => <span key={i.id} className="chip static">{i.title}</span>) : <span className="muted">이미 좋은 습관이에요. 지금처럼만!</span>}
        </div>
        {calc.road.length > 0 && (
          <>
            <h3 className="road-title">되고 싶은 모습(100%)으로 가는 길</h3>
            <ol className="road">
              <li><span>퀘스트를 모두 지키면</span><b>{pct(calc.keepClose)}</b></li>
              {calc.road.map(r => (
                <li key={r.label}><span>+ {r.label}</span><b>{pct(r.close)}</b></li>
              ))}
            </ol>
          </>
        )}
        <p className="muted small">
          {sim.adherenceAssumed ? '아직 미션 기록이 없어서 달성률 60%로 가정했어요.' : `내 최근 미션 달성률 ${Math.round(sim.adherence * 100)}%로 계산했어요. 미션을 더 지키면 미래가 바뀌어요.`}{' '}
          습관이 이어진다는 가정의 시뮬레이션이에요. 예언이 아니고, 의료 진단도 아니에요.
        </p>
      </section>

      {aiEnabled && (
        <details className="card ask">
          <summary>💬 미래의 나에게 물어보기</summary>
          <FutureChat compact />
        </details>
      )}
    </div>
  );
}
