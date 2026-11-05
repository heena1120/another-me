'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, CHALLENGES, explorePoints, levelOf, pickChallenge, todayKey } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';
import { useTwinState } from '@/lib/twin-store';

export default function Explore() {
  const state = useTwinState();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  // 오늘의 도전은 하루에 한 번, 내가 자주 하지 않는 영역에서 골라 고정합니다.
  useEffect(() => {
    if (!state || state.explore.usual.length === 0) return;
    const today = todayKey();
    if (state.explore.log[today]) return;
    twinActions.setExplore(today, pickChallenge(state.explore.usual, state.explore.log, today).id);
  }, [state]);

  if (!state) return <p className="muted" role="status">불러오는 중…</p>;

  const { usual, log } = state.explore;
  const today = todayKey(); // 브라우저에서 데이터를 읽은 뒤에만 실행됩니다.
  const stats = explorePoints(log);
  const lv = levelOf(stats.points);

  if (usual.length === 0 || editing) {
    return (
      <section className="card">
        <h2>요즘 자주 하는 건 뭐예요?</h2>
        <p className="muted">알고리즘이 나를 가둔 영역을 알려 주세요. 쌍둥이가 <b>자주 안 하는 영역</b>에서 도전을 골라 줘요. (1개 이상)</p>
        <div className="chips" role="group" aria-label="자주 하는 영역">
          {CATEGORIES.map(c => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                className={`chip${on ? ' selected' : ''}`}
                onClick={() => setPicked(p => (p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id]))}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="actions">
          {editing && (
            <button type="button" className="btn ghost" onClick={() => { setEditing(false); setPicked([]); }}>취소</button>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={picked.length === 0}
            onClick={() => {
              twinActions.saveUsual(picked);
              setEditing(false);
              setPicked([]);
            }}
          >
            저장하고 도전 받기
          </button>
        </div>
      </section>
    );
  }

  const entry = log[today];
  const challenge = entry ? CHALLENGES.find(c => c.id === entry.id) : undefined;
  const cat = challenge ? CATEGORIES.find(c => c.id === challenge.category)?.label : '';
  const history = Object.keys(log)
    .filter(d => log[d].done)
    .sort()
    .reverse()
    .slice(0, 5);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>오늘의 도전</h2>
          <span className="points">{cat}</span>
        </div>
        {challenge ? (
          <label className={`explore-item${entry?.done ? ' done' : ''}`}>
            <input type="checkbox" checked={entry?.done ?? false} onChange={() => twinActions.toggleExplore(today)} />
            <span className="check-body">
              <strong>{challenge.title}</strong>
              <small>약 {challenge.minutes}분 · 해내면 +15점{entry?.done ? '' : ' (처음 해보는 영역이면 +10 보너스)'}</small>
            </span>
          </label>
        ) : (
          <p className="muted" role="status">오늘의 도전을 고르는 중…</p>
        )}
        <p className="muted small">도전은 준비된 목록에서 내가 자주 안 하는 영역을 우선해서 하루에 하나 골라요. 하루에 한 번 정해지면 바뀌지 않아요.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>내 탐험 레벨</h2>
          <span className="points">Lv.{lv.level}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)} aria-label="다음 탐험 레벨까지">
          <span style={{ width: `${Math.max(4, Math.round(lv.progress * 100))}%` }} />
        </div>
        <p className="muted">
          {stats.points}점 · 해낸 도전 {stats.done}개 · 처음 해본 영역 {stats.categories}/{CATEGORIES.length}
        </p>
        {history.length > 0 && (
          <ul className="facts">
            {history.map(d => {
              const c = CHALLENGES.find(x => x.id === log[d].id);
              return <li key={d}>{d.slice(5)} · {c?.title ?? '도전'}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>내가 자주 하는 영역</h2>
        <p className="muted">{usual.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean).join(' · ')}</p>
        <button type="button" className="btn ghost small" onClick={() => { setPicked(usual); setEditing(true); }}>
          다시 고르기
        </button>
      </section>
    </div>
  );
}
