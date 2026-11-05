'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TwinStage from '@/components/TwinStage';
import LossChart from '@/components/LossChart';
import QuestTray, { questGain, questShort } from '@/components/home/QuestTray';
import LevelUp from '@/components/home/LevelUp';
import { useAvatar } from '@/lib/avatar-store';
import { predict } from '@/lib/twin-model';
import { generatePlan, improvedHabits, pickChallenge, todayKey, type PlanItem } from '@/lib/twin-data';
import { acceptProbs, closenessOf, completionRate, idealRange, levelOfScore, levelUpPath, missionStats, moodForVitality, residualStd, simulate5y, vitalityOf } from '@/lib/twin-sim';
import { twinActions } from '@/lib/twin-store';
import { useTwin } from '@/lib/use-twin';

const pct = (c: number) => `${Math.round(c * 100)}%`;

export default function HomeTwin() {
  const router = useRouter();
  const avatar = useAvatar();
  const { state, model, baseHabits, training } = useTwin();
  const [pops, setPops] = useState<{ id: number; text: string }[]>([]);

  const profile = state?.profile ?? null;
  const plans = state?.plans;
  const checkins = state?.checkins;
  const today = state ? todayKey() : ''; // 브라우저에서 데이터를 읽은 뒤에만 계산됩니다.
  const plan: PlanItem[] | undefined = plans?.[today];

  // 내가 실제로 지킨 미션 기록에서 "지킬 확률"을 배워 추천에 반영합니다.
  const accept = useMemo(() => (plans ? acceptProbs(missionStats(plans, todayKey())) : {}), [plans]);

  // 지금 상태 분석: 체크한 미션을 지켰다고 가정한 습관으로 점수를 다시 계산하고, 레벨·근접도·레벨업 경로를 구합니다.
  const view = useMemo(() => {
    if (!profile || !model || !baseHabits || !plans || !checkins) return null;
    const ideal = idealRange(model);
    const doneIds = (plan ?? []).filter(i => i.done).map(i => i.id);
    const live = predict(model, improvedHabits(profile, baseHabits, doneIds));
    const lv = levelOfScore(live, ideal);
    const path = plan && lv.nextAtScore !== null ? levelUpPath(model, profile, baseHabits, plan, lv.nextAtScore + 0.01) : null;
    const sim = simulate5y(model, profile, baseHabits, { adherence: completionRate(plans, todayKey()), sigma: residualStd(checkins), items: plan, accept });
    return { live, lv, path, future: closenessOf(sim.traj[60].improved, ideal) };
  }, [profile, model, baseHabits, plans, checkins, plan, accept]);

  const levelNow = view?.lv.level ?? null;

  // 아직 캐릭터를 만든 적이 없으면 캐릭터 만들기로 보냅니다.
  useEffect(() => {
    if (avatar === null) router.replace('/create');
  }, [avatar, router]);

  // 오늘 미션은 하루에 한 번, 쌍둥이 모델의 what-if 결과에 "내가 지킬 확률"을 곱해서 정합니다.
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
      <div className="hero loading" role="status" aria-live="polite">
        <div className="blob-skeleton" aria-hidden="true" />
        <p>내 쌍둥이를 불러오는 중…</p>
      </div>
    );
  }

  const lv = view?.lv ?? null;
  const dance = lv !== null && state.seenLevel !== null && lv.level > state.seenLevel;
  const vitality = view ? vitalityOf(view.live) : 0.6;
  const allDone = !!plan && plan.length > 0 && plan.every(i => i.done);
  const checkedToday = state.checkins.some(c => c.date === today);
  const exploreEntry = state.explore.log[today];
  const hintIds = view?.path ?? [];

  // 말풍선: "지금 레벨 → 레벨업하려면 뭘 해야 하는지"를 한 줄로
  let bubble: string;
  if (!profile) bubble = '나를 소개해 줘! 지금 내 레벨을 분석해 줄게.';
  else if (training) bubble = '내 안의 신경망을 학습하는 중이야…';
  else if (!lv) bubble = '지금 내 상태를 분석하는 중이야…';
  else if (lv.level >= 10) bubble = '완벽한 나 도착! 이 습관을 계속 이어가 보자.';
  else if (hintIds.length > 0 && plan) {
    const names = plan.filter(i => hintIds.includes(i.id)).map(i => `‘${questShort(i.id, i.title)}’`).join(' + ');
    bubble = `Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점! ${names}${hintIds.length > 1 ? ' 하면 돼' : ' 하나면 돼'}`;
  } else if (allDone) bubble = `미션 완료! Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점 남았어. 습관을 쌓으면 올라가.`;
  else bubble = `Lv.${lv.level + 1}까지 +${Math.ceil(lv.toNext ?? 0)}점. 체크인으로 습관을 쌓으면 올라가.`;

  const toggle = (item: PlanItem) => {
    twinActions.toggleItem(today, item.id);
    if (!item.done) {
      const id = Date.now();
      setPops(p => [...p, { id, text: `+${questGain(item)}점` }]);
      setTimeout(() => setPops(p => p.filter(x => x.id !== id)), 1200);
    }
  };

  return (
    <>
      <div className="hero">
        <TwinStage avatar={avatar} height="fill" lift={-0.12} distance={9.4} dance={dance} vitality={vitality} mood={moodForVitality(vitality)} />

        <div className="hud">
          <div className="hud-top">
            <div className="lvl" role="img" aria-label={lv ? `레벨 ${lv.level} ${lv.name}, 다음 레벨까지 ${Math.round(lv.progress * 100)}%` : '레벨 분석 중'}>
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="19" fill="#fff" stroke="#e9dfe3" strokeWidth="4" />
                <circle cx="22" cy="22" r="19" fill="none" stroke="#ff5c8a" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.max(0.03, lv?.progress ?? 0) * 119.4} 119.4`} transform="rotate(-90 22 22)" />
              </svg>
              <span><small>Lv</small>{lv?.level ?? '–'}</span>
            </div>
            <div className="score" aria-label="완벽한 나에 가까운 정도">
              <small className="lvname">{lv ? lv.name : '분석 중'}</small>
              <strong>{lv ? pct(lv.closeness) : '–'}</strong>
              <small>완벽한 나까지</small>
            </div>
            <div className="spacer" />
          </div>

          {!dance && <p className="hud-bubble">{bubble}</p>}

          {view && (
            <Link className="future-chip" href="/future">
              5년 뒤 <b>{pct(view.future)}</b> ↗
            </Link>
          )}

          <div className="pops" aria-hidden="true">
            {pops.map(p => (
              <span key={p.id} className="pop">{p.text}</span>
            ))}
          </div>

          <div className="hud-bottom">
            {!profile && <Link className="btn primary hud-cta" href="/interview">나 소개하기 (1분)</Link>}
            {profile && training && (
              <div className="train-card" role="status">
                <small>사전학습 {training.epoch}/{training.epochs}</small>
                <LossChart history={training.history} height={60} />
              </div>
            )}
            {profile && plan && plan.length > 0 && <QuestTray items={plan} hintIds={hintIds} onToggle={toggle} />}
            {profile && plan && plan.length === 0 && <p className="hud-note">이미 좋은 습관이에요. 체크인으로 쌍둥이를 키워 보세요!</p>}
            <div className="hud-links">
              <Link href="/explore" className="hud-link">🧭 탐험{exploreEntry?.done ? ' ✓' : ''}</Link>
              <Link href="/checkin" className="hud-link strong">📸 체크인{checkedToday ? ' ✓' : ''}</Link>
            </div>
          </div>
        </div>

        {dance && lv && <LevelUp level={lv.level} />}
      </div>

      <p className="foot-links">
        <Link href="/create">✏️ 캐릭터 꾸미기</Link>
        <Link href="/interview">⚙ 내 정보 다시 입력</Link>
      </p>
    </>
  );
}
