'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TwinStage from '@/components/TwinStage';
import LossChart from '@/components/LossChart';
import LevelUp from '@/components/home/LevelUp';
import { useAvatar } from '@/lib/avatar-store';
import { predict } from '@/lib/twin-model';
import { generatePlan, improvedHabits, pickChallenge, todayKey, type PlanItem } from '@/lib/twin-data';
import { difficultyOf, minutesLabel, questGain, questIcon, questShort } from '@/lib/quest-meta';
import { acceptProbs, closenessOf, completionRate, idealRange, levelOfScore, levelUpPath, missionStats, moodForVitality, residualStd, simulate5y, vitalityOf } from '@/lib/twin-sim';
import { twinActions } from '@/lib/twin-store';
import { useTwin } from '@/lib/use-twin';

const pct = (c: number) => `${Math.round(c * 100)}%`;

export default function HomeTwin() {
  const router = useRouter();
  const avatar = useAvatar();
  const { state, model, baseHabits, training } = useTwin();

  const profile = state?.profile ?? null;
  const plans = state?.plans;
  const checkins = state?.checkins;
  const today = state ? todayKey() : ''; // 브라우저에서 데이터를 읽은 뒤에만 계산됩니다.
  const plan: PlanItem[] | undefined = plans?.[today];

  // 내가 실제로 지킨 퀘스트 기록에서 "지킬 확률"을 배워 추천에 반영합니다.
  const accept = useMemo(() => (plans ? acceptProbs(missionStats(plans, todayKey())) : {}), [plans]);

  // 지금 상태 분석: 체크한 퀘스트를 지켰다고 가정한 습관으로 점수를 다시 계산하고, 레벨·근접도·레벨업 경로를 구합니다.
  const view = useMemo(() => {
    if (!profile || !model || !baseHabits || !plans || !checkins) return null;
    const ideal = idealRange(model);
    const doneIds = (plan ?? []).filter(i => i.done).map(i => i.id);
    const live = predict(model, improvedHabits(profile, baseHabits, doneIds));
    const lv = levelOfScore(live, ideal);
    const path = plan && lv.nextAtScore !== null ? levelUpPath(model, profile, baseHabits, plan, lv.nextAtScore + 0.01) : null;
    const sim = simulate5y(model, profile, baseHabits, { adherence: completionRate(plans, todayKey()), sigma: residualStd(checkins), items: plan, accept });
    return { live, lv, path, now: closenessOf(sim.traj[0].now, ideal), future: closenessOf(sim.traj[60].improved, ideal) };
  }, [profile, model, baseHabits, plans, checkins, plan, accept]);

  const levelNow = view?.lv.level ?? null;

  // 아직 캐릭터를 만든 적이 없으면 시작 화면으로 보냅니다.
  useEffect(() => {
    if (avatar === null) router.replace('/welcome');
  }, [avatar, router]);

  // 오늘 퀘스트는 하루에 한 번, 쌍둥이 모델의 what-if 결과에 "내가 지킬 확률"을 곱해서 정합니다.
  useEffect(() => {
    const day = todayKey();
    if (!state?.profile || !model || !baseHabits || state.plans[day]) return;
    twinActions.setPlan(day, generatePlan(model, state.profile, baseHabits, 4, accept));
  }, [state, model, baseHabits, accept]);

  // 오늘의 탐험 도전도 홈에서 정해 둡니다.
  useEffect(() => {
    if (!state || state.explore.usual.length === 0) return;
    const day = todayKey();
    if (state.explore.log[day]) return;
    twinActions.setExplore(day, pickChallenge(state.explore.usual, state.explore.log, day).id);
  }, [state]);

  // 레벨업 감지: 마지막으로 축하한 레벨보다 오르면 캐릭터가 춤춥니다. 처음이거나 레벨이 내려가면 조용히 맞춥니다.
  useEffect(() => {
    if (!state || levelNow === null) return;
    if (state.seenLevel === null || levelNow < state.seenLevel) {
      twinActions.markLevelSeen(levelNow);
      return;
    }
    if (levelNow > state.seenLevel) {
      const t = setTimeout(() => twinActions.markLevelSeen(levelNow), 4800);
      return () => clearTimeout(t);
    }
  }, [state, levelNow]);

  if (!avatar || !state) {
    return (
      <div className="twin-card" role="status" aria-live="polite" style={{ display: 'grid', placeItems: 'center', minHeight: 360, color: '#7a7592' }}>
        <p>내 트윈을 불러오는 중…</p>
      </div>
    );
  }

  const lv = view?.lv ?? null;
  const dance = lv !== null && state.seenLevel !== null && lv.level > state.seenLevel;
  const vitality = view ? vitalityOf(view.live) : 0.6;
  const allDone = !!plan && plan.length > 0 && plan.every(i => i.done);
  const hintIds = view?.path ?? [];

  // 한 줄 안내: "지금 레벨 → 레벨업하려면 뭘 해야 하는지"
  let hint: string;
  if (!profile) hint = '나를 소개해 주면 지금 내 상태를 분석해 줄게요.';
  else if (training) hint = '내 안의 신경망을 학습하는 중이에요…';
  else if (!lv) hint = '지금 내 상태를 분석하는 중이에요…';
  else if (lv.level >= 10) hint = '완벽한 나에 도착했어요! 이 습관을 이어 가 보세요.';
  else if (hintIds.length > 0 && plan) {
    const names = plan.filter(i => hintIds.includes(i.id)).map(i => `‘${questShort(i.id, i.title)}’`).join(' + ');
    hint = `Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점 · ${names}${hintIds.length > 1 ? ' 를 해 보세요' : ' 하나면 돼요'}`;
  } else if (allDone) hint = `퀘스트 완료! Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점 남았어요. 습관을 쌓으면 올라가요.`;
  else hint = `Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점. 체크인으로 습관을 쌓으면 올라가요.`;

  return (
    <>
      <section className="twin-card" aria-label="MY TWIN">
        <div className="twin-stage">
          <TwinStage avatar={avatar} height="fill" lift={-0.1} distance={8.4} dance={dance} vitality={vitality} mood={moodForVitality(vitality)} />
        </div>
        <div className="twin-badges">
          <span className="twin-name">
            <small>{lv ? `Lv.${lv.level}` : 'Lv.–'}</small>
            {avatar.name}
          </span>
        </div>
        {dance && lv && <LevelUp level={lv.level} />}

        <div className="twin-info">
          <div className="growth">
            <div className="growth-head">
              <strong>{lv ? lv.name : '분석 중'}</strong>
              <span>{lv ? `되고 싶은 모습까지 ${pct(lv.closeness)}` : ''}</span>
            </div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((lv?.progress ?? 0) * 100)} aria-label="다음 레벨까지">
              <span style={{ width: `${Math.max(4, Math.round((lv?.progress ?? 0) * 100))}%` }} />
            </div>
          </div>
          <p className="hint-line">{hint}</p>
          {profile && training && (
            <div role="status">
              <LossChart history={training.history} height={56} />
            </div>
          )}
          {!profile && (
            <Link className="btn primary" href="/onboarding">
              나 소개하기 (1분)
            </Link>
          )}
          <div className="twin-actions">
            <Link className="btn" href="/create">✏️ 꾸미기</Link>
            <Link className="btn" href="/checkin">📸 체크인</Link>
          </div>
        </div>
      </section>

      {profile && plan && (
        <section className="section" aria-label="오늘의 AI QUEST">
          <div className="section-head">
            <h2>오늘의 AI QUEST</h2>
            <Link href="/quests">자세히 보기</Link>
          </div>
          {plan.length === 0 && <p className="card muted">이미 좋은 습관이에요. 체크인으로 쌍둥이를 키워 보세요!</p>}
          {plan.map(item => {
            const hintHere = !item.done && hintIds.includes(item.id);
            return (
              <div key={item.id} className={`qrow${item.done ? ' done' : ''}`}>
                <span className="qicon" aria-hidden="true">{questIcon(item.id)}</span>
                <div className="qtext">
                  <strong>{item.title}</strong>
                  <div className="qmeta">
                    <span className={`tag ${difficultyOf(item, accept[item.id]) === '쉬움' ? 'easy' : difficultyOf(item, accept[item.id]) === '도전' ? 'hard' : ''}`}>{difficultyOf(item, accept[item.id])}</span>
                    <span>{minutesLabel(item)}</span>
                    <span className="tag xp">+{questGain(item)}점</span>
                    {hintHere && <span className="tag">레벨업!</span>}
                  </div>
                </div>
                <button type="button" className="check" aria-pressed={item.done} aria-label={`${item.title} ${item.done ? '완료 취소' : '완료'}`} onClick={() => twinActions.toggleItem(today, item.id)}>
                  ✓
                </button>
              </div>
            );
          })}
        </section>
      )}

      {view && (
        <section className="card" aria-label="5년 뒤 미리보기">
          <div className="section-head">
            <h2>FUTURE ME 미리보기</h2>
            <Link href="/future">비교하기</Link>
          </div>
          <div className="preview-future">
            <div>
              <strong>{pct(view.now)}</strong>
              <small>지금 습관 유지</small>
            </div>
            <span className="arrow" aria-hidden="true">→</span>
            <div className="good">
              <strong>{pct(view.future)}</strong>
              <small>퀘스트를 지키면 5년 뒤</small>
            </div>
          </div>
          <p className="muted small">현재 습관을 바탕으로 만든 가상 시나리오예요. 확정된 예측이 아니에요.</p>
        </section>
      )}

      <p className="foot-links">
        <Link href="/explore">🧭 탐험</Link>
        <Link href="/analysis">🧠 신경망 분석 근거</Link>
        <Link href="/trace">🔎 AI TRACE</Link>
      </p>
    </>
  );
}
