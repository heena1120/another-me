// 프로그램 로직(XP·레벨·그림자·월드) 검사: `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { growthOf, totalXp, xpIfDone, dayXp, DAILY_XP_CAP, xpForLevel, rewardsAt, unlockedRewards } from '../lib/growth.ts';
import { shadowStates, withBattle, withMicro, SHADOWS } from '../lib/shadow.ts';
import { worldState, roomStage } from '../lib/world.ts';
import { UNLOCK, isUnlocked, randomAvatar } from '../lib/avatar.ts';

const item = (id, o = {}) => ({ id, title: id, reason: '', points: 1, gain: 2, done: false, ...o });
const profile = { sleep: 'irregular', shortform: 'heavy', walk: 'none', pref: 'none', job: 'student', selfcare: 'rarely' };

test('XP는 완료한 퀘스트에서만 나오고 하루 상한이 있다', () => {
  assert.equal(totalXp({}), 0);
  const plans = { d1: [item('walk', { aiDifficulty: '쉬움', minutes: 10 })] };
  assert.equal(totalXp(plans), 0);
  plans.d1[0].done = true;
  assert.equal(xpIfDone(plans.d1[0]), 15);
  assert.equal(totalXp(plans), 15);
  const many = Array.from({ length: 10 }, (_, i) => item('q' + i, { done: true, aiDifficulty: '도전', minutes: 30 }));
  assert.equal(dayXp(many), DAILY_XP_CAP);
  plans.d1[0].done = false;
  assert.equal(totalXp(plans), 0, '완료를 취소하면 XP도 사라진다');
});

test('레벨은 XP에 따라 단조 증가하고 10에서 멈춘다', () => {
  let prev = 0;
  for (let xp = 0; xp < 5000; xp += 7) {
    const g = growthOf(xp);
    assert.ok(g.level >= prev && g.level <= 10);
    prev = g.level;
  }
  assert.equal(growthOf(0).level, 1);
  assert.equal(growthOf(xpForLevel(2) - 1).level, 1);
  assert.equal(growthOf(xpForLevel(2)).level, 2);
  assert.equal(growthOf(99999).need, null);
});

test('보상은 레벨에서만 열리고 모든 항목이 열릴 수 있다', () => {
  assert.equal(isUnlocked('accessory', 'glasses', 2), false);
  assert.equal(isUnlocked('accessory', 'glasses', 3), true);
  const all = Object.values(UNLOCK).reduce((n, m) => n + Object.values(m).filter(l => l > 1).length, 0);
  assert.equal(unlockedRewards(10).length, all);
  assert.ok(rewardsAt(2).length > 0);
  for (let i = 0; i < 40; i++) {
    const a = randomAvatar('x', 1);
    assert.ok(isUnlocked('accessory', a.accessory, 1) && isUnlocked('outfit', a.outfit, 1) && isUnlocked('hair', a.hair, 1) && isUnlocked('ears', a.ears, 1) && isUnlocked('pose', a.pose, 1));
  }
});

test('그림자는 퀘스트를 해낼수록 작아지고 0~100 안에 있다', () => {
  const before = shadowStates(profile, {});
  const plans = { d1: [item('screen', { done: true }), item('sleep', { done: true }), item('walk', { done: true })] };
  const after = shadowStates(profile, plans);
  for (let i = 0; i < before.length; i++) {
    assert.ok(after[i].strength <= before[i].strength);
    assert.ok(after[i].strength >= 0 && after[i].strength <= 100);
  }
  assert.ok(after.find(s => s.def.id === 'night').strength < before.find(s => s.def.id === 'night').strength);
  assert.equal(before.length, SHADOWS.length);
});

test('SHADOW BATTLE: 맞서는 퀘스트를 지정하거나 작은 단계를 더하고, 중복하지 않는다', () => {
  const night = SHADOWS.find(s => s.id === 'night');
  const r1 = withBattle([item('sleep')], night);
  assert.equal(r1.items[0].shadow, 'night');
  assert.equal(r1.added, false);
  const r2 = withBattle([item('water')], night);
  assert.equal(r2.added, true);
  assert.ok(r2.items.at(-1).micro && r2.items.at(-1).shadow === 'night');
  assert.equal(withBattle(r2.items, night).items.length, r2.items.length);
  const bonus = { ...r1.items[0], done: true, aiDifficulty: '쉬움' };
  assert.equal(xpIfDone(bonus), 15);
});

test('못 한 퀘스트는 더 작은 단계가 되고 못 한 기록이 돌아온다', () => {
  const failed = item('walk', { fail: { reason: '귀찮았어요', at: 1 }, minutes: 20 });
  const { items, failed: f } = withMicro([failed], 'walk');
  assert.equal(f.id, 'walk');
  assert.ok(items[0].micro && items[0].minutes <= 2 && items[0].gain <= failed.gain);
  assert.equal(withMicro([item('walk', { done: true })], 'walk').failed, null);
});

test('월드는 레벨과 해낸 퀘스트 횟수로 열린다', () => {
  const none = worldState(1, {});
  assert.equal(none.filter(s => s.unlocked).length, 0);
  const plans = { d1: [item('sleep', { done: true })], d2: [item('screen', { done: true })], d3: [item('sleep', { done: true })] };
  const w = worldState(1, plans);
  assert.ok(w.find(s => s.item.id === 'bed').unlocked);
  assert.ok(!w.find(s => s.item.id === 'desk').unlocked);
  assert.ok(worldState(3, {}).find(s => s.item.id === 'desk').unlocked);
  assert.equal(roomStage(1).stage, 1);
  assert.equal(roomStage(10).stage, 4);
});
