'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TwinStage from '@/components/TwinStage';
import LossChart from '@/components/LossChart';
import LevelUp from '@/components/home/LevelUp';
import { useAvatar } from '@/lib/avatar-store';
import { DAILY_XP_CAP, dayXp, growthOf, nextReward, rewardsAt, totalXp, xpIfDone, xpPath } from '@/lib/growth';
import { predict } from '@/lib/twin-model';
import { generatePlan, improvedHabits, pickChallenge, todayKey, type PlanItem } from '@/lib/twin-data';
import { difficultyOf, minutesLabel, questIcon, questShort } from '@/lib/quest-meta';
import { acceptProbs, closenessOf, completionRate, idealRange, missionStats, moodForVitality, residualStd, simulate5y, vitalityOf } from '@/lib/twin-sim';
import { MAX_QUEST_COUNT, twinActions } from '@/lib/twin-store';
import { useAiCoach } from '@/lib/use-ai-coach';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { useTwin } from '@/lib/use-twin';

const pct = (c: number) => `${Math.round(c * 100)}%`;
const localDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE');

type Future = 'now' | 'off' | 'on';

export default function HomeTwin() {
  const router = useRouter();
  const avatar = useAvatar();
  const twin = useTwin();
  const { state, model, baseHabits, training } = twin;
  const ai = useAiStatus();
  const { run, busy, error } = useAiCoach(twin);
  const [future, setFuture] = useState<Future>('now');
  const autoRan = useRef<string | null>(null);

  const profile = state?.profile ?? null;
  const plans = state?.plans;
  const checkins = state?.checkins;
  const today = state ? todayKey() : ''; // 브라우저에서 데이터를 읽은 뒤에만 계산됩니다.
  const plan: PlanItem[] | undefined = plans?.[today];
  const coach = state?.ai.coach ?? null;
  const count = state?.questCount ?? 2;

  // 내가 실제로 지킨 퀘스트 기록에서 "지킬 확률"을 배워 추천에 반영합니다.
  const accept = useMemo(() => (plans ? acceptProbs(missionStats(plans, todayKey())) : {}), [plans]);

  // 신경망 계산: 지금 컨디션, 5년 뒤(지금 습관 / 퀘스트 지킬 때)
  const view = useMemo(() => {
    if (!profile || !model || !baseHabits || !plans || !checkins) return null;
    const ideal = idealRange(model);
    const doneIds = (plan ?? []).filter(i => i.done).map(i => i.id);
    const live = predict(model, improvedHabits(profile, baseHabits, doneIds));
    const sim = simulate5y(model, profile, baseHabits, { adherence: completionRate(plans, todayKey()), sigma: residualStd(checkins), items: plan, accept });
    const off = sim.traj[60].now;
    const on = sim.traj[60].improved;
    return { live, offClose: closenessOf(off, ideal), onClose: closenessOf(on, ideal), vOff: vitalityOf(off), vOn: vitalityOf(on) };
  }, [profile, model, baseHabits, plans, checkins, plan, accept]);

  // 레벨은 '완료한 퀘스트'에서 계산한 XP로 정해집니다. (신경망 점수와는 별개)
  const growth = useMemo(() => (plans ? growthOf(totalXp(plans)) : null), [plans]);
  const levelNow = growth?.level ?? null;

  // 아직 캐릭터를 만든 적이 없으면 시작 화면으로 보냅니다.
  useEffect(() => {
    if (avatar === null) router.replace('/welcome');
  }, [avatar, router]);

  // 오늘 퀘스트는 하루에 한 번, 쌍둥이 모델의 what-if 결과에 "내가 지킬 확률"을 곱해서 정합니다. (AI가 바꾸기 전 기본값)
  useEffect(() => {
    const day = todayKey();
    if (!state?.profile || !model || !baseHabits || state.plans[day]) return;
    twinActions.setPlan(day, generatePlan(model, state.profile, baseHabits, state.questCount, accept));
  }, [state, model, baseHabits, accept]);

  // AI는 하루에 한 번 스스로 나를 다시 읽고, 오늘 체크인을 하면 그 기록을 반영해 한 번 더 읽습니다.
  useEffect(() => {
    if (!ai?.enabled || !state?.profile || !model || !baseHabits || busy) return;
    const day = todayKey();
    const key = `${day}:${state.lastCheckinAt ?? 0}`;
    if (!state.plans[day] || autoRan.current === key) return;
    const c = state.ai.coach;
    const stale = !!c && state.lastCheckinAt !== null && state.lastCheckinAt > Date.parse(c.at);
    if (c && localDay(c.at) === day && !stale) return;
    autoRan.current = key;
    void run(c ? 'reanalyze' : 'initial');
  }, [ai, state, model, baseHabits, busy, run]);

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
      <div className="go-stage" role="status" aria-live="polite" style={{ display: 'grid', placeItems: 'center', color: '#7a7592' }}>
        <p>내 트윈을 불러오는 중…</p>
      </div>
    );
  }

  const dance = growth !== null && state.seenLevel !== null && growth.level > state.seenLevel;
  const todayXp = dayXp(plan);
  const unlocks = growth ? rewardsAt(growth.level) : [];
  const upcoming = growth ? nextReward(growth.level) : null;
  const path = plan && growth && growth.need !== null ? xpPath(plan, growth.need) : null;
  const hintIds = path?.ids ?? [];
  const allDone = !!plan && plan.length > 0 && plan.every(i => i.done);
  const aiPlan = !!plan && plan.some(i => i.source === 'ai');
  const checkinToday = state.checkins.find(c => c.date === today) ?? null;
  const verified = plan ? plan.filter(i => i.source === 'ai' && i.verified).length : 0;

  // 캐릭터의 생기: FUTURE SWITCH에 따라 지금 / 5년 뒤(OFF) / 5년 뒤(ON)
  const vitalityNow = view ? vitalityOf(view.live) : 0.6;
  const vitality = !view || future === 'now' ? vitalityNow : future === 'off' ? view.vOff : view.vOn;

  // 트윈의 말풍선: AI가 나를 읽은 한 줄. AI가 없으면 그 사실을 말해요.
  const bubble: { ai: boolean; text: string; href: string } | null = coach
    ? { ai: true, text: coach.result.summary, href: '/scan' }
    : busy
      ? { ai: true, text: '지금 내 답변과 기록을 읽는 중이에요…', href: '/scan' }
      : ai && !ai.enabled && profile
        ? { ai: false, text: 'AI가 연결되면 내 숨은 패턴을 읽어 줄게요.', href: '/scan' }
        : null;

  // 한 줄 안내
  let hint: string;
  if (!profile) hint = '나를 소개해 주면 AI가 지금 내 상태를 읽어 줄게요.';
  else if (future === 'off' && view) hint = `지금 습관을 5년 이어 가면 되고 싶은 모습까지 ${pct(view.offClose)} · 가상 시나리오예요.`;
  else if (future === 'on' && view) hint = `오늘 퀘스트를 지켜 가면 5년 뒤 ${pct(view.onClose)} · 가상 시나리오예요.`;
  else if (training) hint = '내 안의 신경망을 학습하는 중이에요…';
  else if (!growth) hint = '지금 내 상태를 분석하는 중이에요…';
  else if (growth.need === null) hint = '최고 레벨이에요! 이 습관을 이어 가 보세요.';
  else if (hintIds.length > 0 && plan) {
    const names = plan.filter(i => hintIds.includes(i.id)).map(i => `‘${questShort(i.id, i.title)}’`).join(' + ');
    hint = `Lv.${growth.level + 1}까지 +${growth.need}XP · ${names}${hintIds.length > 1 ? ' 를 해 보세요' : ' 하나면 돼요'}`;
  } else if (allDone) hint = `오늘 퀘스트 완료! Lv.${growth.level + 1}까지 ${growth.need}XP 남았어요. 내일 이어 가요.`;
  else if (todayXp >= DAILY_XP_CAP) hint = `오늘 얻을 수 있는 XP(${DAILY_XP_CAP})를 다 채웠어요. 내일 또 만나요.`;
  else hint = `Lv.${growth.level + 1}까지 ${growth.need}XP${upcoming ? ` · 오르면 ${upcoming.rewards[0]?.text ?? '새 꾸미기'} 열려요` : ''}`;

  const setCount = (n: number) => {
    const filler = model && profile && baseHabits ? generatePlan(model, profile, baseHabits, 8, accept) : [];
    twinActions.setQuestCount(n, filler);
  };

  return (
    <>
      <section className="go" aria-label="MY TWIN">
        <div className={`go-stage${future !== 'now' ? ` future-${future}` : ''}`}>
          <TwinStage avatar={avatar} height="fill" lift={-0.22} distance={7.3} dance={dance} vitality={vitality} mood={moodForVitality(vitality)} />

          <div className="go-profile" aria-label="내 트윈">
            <strong>{avatar.name}</strong>
            <span>{growth ? `Lv.${growth.level} · ${growth.xp}${growth.next !== null ? ` / ${growth.next}` : ''}XP` : 'Lv.–'}</span>
            <i className="go-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((growth?.progress ?? 0) * 100)} aria-label="다음 레벨까지">
              <b style={{ width: `${Math.max(4, Math.round((growth?.progress ?? 0) * 100))}%` }} />
            </i>
          </div>

          <div className="go-side">
            <Link className="go-btn" href="/create" aria-label="트윈 꾸미기" title="꾸미기">✏️</Link>
            <Link className="go-btn" href="/checkin" aria-label="체크인" title="체크인">📸</Link>
            <Link className="go-btn" href="/world" aria-label="ANOTHER WORLD" title="월드">🏠</Link>
          </div>

          {future !== 'now' && view && <span className="go-future-badge">5년 뒤 · {future === 'off' ? '지금 습관' : '퀘스트 지키면'} {pct(future === 'off' ? view.offClose : view.onClose)}</span>}

          {bubble && (
            <Link className="twin-bubble" href={bubble.href} aria-label={bubble.ai ? 'AI가 읽은 나 자세히 보기' : '분석 보기'}>
              <span className={`tag${bubble.ai ? ' ai' : ''}`}>{bubble.ai ? 'AI' : '안내'}</span>
              <span className="txt">{bubble.text}</span>
            </Link>
          )}
          {dance && growth && <LevelUp level={growth.level} rewards={unlocks.map(r => r.text)} />}
        </div>

        {profile && !checkinToday && (
          <Link className="checkin-cta" href="/checkin">
            <strong>📸 오늘의 나 체크인 <small>1분</small></strong>
            <span>잠·걸음·화면 시간을 적으면 AI가 이걸 배우고 오늘 퀘스트를 맞춰요</span>
          </Link>
        )}
        {profile && checkinToday && (
          <p className="checkin-done">✓ 오늘 체크인 완료 · 컨디션 {Math.round(checkinToday.actual)}점{busy ? ' · AI가 반영하는 중…' : ' · AI가 반영했어요'}</p>
        )}

        {view && (
          <div className="go-switch" role="group" aria-label="FUTURE SWITCH">
            <span className="fswitch-label">FUTURE SWITCH</span>
            <div className="seg">
              <button type="button" aria-pressed={future === 'now'} onClick={() => setFuture('now')}>지금</button>
              <button type="button" aria-pressed={future === 'off'} onClick={() => setFuture('off')}>5년 뒤 OFF</button>
              <button type="button" className="on" aria-pressed={future === 'on'} onClick={() => setFuture('on')}>5년 뒤 ON</button>
            </div>
          </div>
        )}

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
      </section>

      {profile && plan && (
        <section className="section" aria-label="오늘의 AI QUEST">
          <div className="section-head">
            <h2>오늘의 QUEST <small className="muted">{todayXp}/{DAILY_XP_CAP}XP</small></h2>
            <div className="stepper" role="group" aria-label="하루 퀘스트 개수">
              <button type="button" aria-label="퀘스트 줄이기" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button>
              <span>{count}개</span>
              <button type="button" aria-label="퀘스트 늘리기" disabled={count >= MAX_QUEST_COUNT} onClick={() => setCount(count + 1)}>+</button>
            </div>
          </div>
          {aiPlan && coach ? (
            <Link className="ai-strip" href="/scan"><span className="tag ai">AI</span> 내 답변·기록으로 만든 퀘스트 · 근거 확인 {verified}/{plan.filter(i => i.source === 'ai').length}{profile.wish ? ' · 내 방식 반영' : ''}</Link>
          ) : busy ? (
            <p className="ai-strip" role="status"><span className="tag ai">AI</span> 나에게 맞는 퀘스트를 만드는 중… 잠시 뒤 바뀌어요</p>
          ) : (
            <p className="ai-strip"><span className="tag">기본</span> 신경망·규칙으로 고른 퀘스트 (AI 아님)</p>
          )}
          {error && <p className="msg error" role="alert">{error}</p>}
          {plan.length === 0 && <p className="card muted">이미 좋은 습관이에요. 체크인으로 쌍둥이를 키워 보세요!</p>}
          {plan.map(item => {
            const hintHere = !item.done && hintIds.includes(item.id);
            const diff = item.aiDifficulty ?? difficultyOf(item, accept[item.id]);
            return (
              <div key={item.id} className={`qrow${item.done ? ' done' : ''}`}>
                <span className="qicon" aria-hidden="true">{questIcon(item.id)}</span>
                <div className="qtext">
                  <strong>{item.title}</strong>
                  <div className="qmeta">
                    {item.source === 'ai' && <span className="tag ai">AI</span>}
                    <span className={`tag ${diff === '쉬움' ? 'easy' : diff === '도전' ? 'hard' : ''}`}>{diff}</span>
                    <span>{minutesLabel(item)}</span>
                    <span className="tag xp">+{xpIfDone(item)}XP</span>
                    {item.shadow && <span className="tag">⚔️ 그림자</span>}
                    {hintHere && <span className="tag">레벨업!</span>}
                  </div>
                </div>
                <button type="button" className="check" aria-pressed={item.done} aria-label={`${item.title} ${item.done ? '완료 취소' : '완료'}`} onClick={() => twinActions.toggleItem(today, item.id)}>
                  ✓
                </button>
              </div>
            );
          })}
          <p className="muted small" style={{ textAlign: 'right' }}><Link href="/quests">퀘스트 자세히 →</Link></p>
        </section>
      )}

      <p className="foot-links">
        <Link href="/future">🔮 FUTURE ME</Link>
        <Link href="/shadow">🌑 MY SHADOW</Link>
        <Link href="/parallel">🪞 PARALLEL ME</Link>
      </p>
    </>
  );
}
