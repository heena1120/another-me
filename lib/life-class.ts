// LIFE CLASS: 사용자가 되고 싶은 미래의 모습. 고르면 AI의 분석 기준·퀘스트 방향과 신경망 기반 추천 가중치가 달라집니다.
import type { LifeClassId } from './ai-types';

export type LifeClassMeta = {
  id: LifeClassId;
  icon: string;
  /** 영어 이름 (서비스 용어) */
  name: string;
  desc: string;
  /** 이 클래스에서 먼저 보는 영역(화면 안내용) */
  focus: string;
  /** AI에게 전달하는 의미 */
  meaning: string;
  /** 예전 목표값과의 호환(신경망 가중치의 기본값) */
  goal: 'stamina' | 'sleep' | 'focus' | 'mood';
};

export const LIFE_CLASSES: LifeClassMeta[] = [
  { id: 'healthy', icon: '💪', name: 'HEALTHY LIFE', desc: '몸이 가볍고 체력이 튼튼한 삶', focus: '활동·운동·규칙적인 식사', meaning: '체력, 활동량, 규칙적인 식사와 수면으로 몸이 건강한 삶', goal: 'stamina' },
  { id: 'creative', icon: '🎨', name: 'CREATIVE LIFE', desc: '깊이 몰입하고 아이디어가 샘솟는 삶', focus: '몰입 시간·휴식·화면 줄이기', meaning: '몰입할 시간과 충분한 휴식, 자극을 줄이는 습관으로 창의적으로 사는 삶', goal: 'focus' },
  { id: 'balanced', icon: '🌿', name: 'BALANCED LIFE', desc: '일·쉼·관계의 균형이 잡힌 삶', focus: '무리 없는 작은 변화', meaning: '한 영역에 치우치지 않고 무리 없는 작은 변화로 균형을 맞추는 삶', goal: 'mood' },
  { id: 'successful', icon: '🚀', name: 'SUCCESSFUL LIFE', desc: '목표를 꾸준히 해내는 삶', focus: '실행 습관·집중·수면 리듬', meaning: '목표를 꾸준히 실행하는 습관, 집중력, 안정적인 수면 리듬으로 성과를 내는 삶', goal: 'focus' },
];

export const lifeClassOf = (id: string | undefined | null) => LIFE_CLASSES.find(c => c.id === id);
