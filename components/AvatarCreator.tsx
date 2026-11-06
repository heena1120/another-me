'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TwinStage from '@/components/TwinStage';
import PhotoAvatar from '@/components/PhotoAvatar';
import {
  ACCESSORIES,
  BACKGROUNDS,
  BLUSHES,
  BODY_COLORS,
  DEFAULT_AVATAR,
  EARS,
  EYES,
  HAIRS,
  HAIR_COLORS,
  POSES,
  MOUTHS,
  OUTFITS,
  OUTFIT_COLORS,
  SHAPES,
  randomAvatar,
  isUnlocked,
  unlockLevel,
  type RewardKind,
  type Avatar,
  type Mood,
} from '@/lib/avatar';
import { saveAvatar, useAvatar } from '@/lib/avatar-store';
import { growthOf, totalXp } from '@/lib/growth';
import { useTwinState } from '@/lib/twin-store';

type Option = { id: string; label: string; value?: string };

function Group<K extends keyof Avatar>({
  title,
  field,
  options,
  avatar,
  onChange,
  swatch = false,
  kind,
  level = 99,
}: {
  title: string;
  field: K;
  options: readonly Option[];
  avatar: Avatar;
  onChange: (field: K, id: Avatar[K]) => void;
  swatch?: boolean;
  /** 레벨 보상으로 열리는 항목이면 종류를 지정 */
  kind?: RewardKind;
  level?: number;
}) {
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      <div className="chips" role="radiogroup" aria-label={title}>
        {options.map(o => {
          const selected = avatar[field] === o.id;
          const locked = kind ? !isUnlocked(kind, o.id, level) : false;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={locked && kind ? `${o.label} (Lv.${unlockLevel(kind, o.id)}에 열려요)` : o.label}
              title={locked && kind ? `Lv.${unlockLevel(kind, o.id)}에 열려요` : o.label}
              disabled={locked}
              className={`chip${swatch ? ' swatch' : ''}${selected ? ' selected' : ''}${locked ? ' locked' : ''}`}
              style={swatch && o.value ? { background: o.value } : undefined}
              onClick={() => onChange(field, o.id as Avatar[K])}
            >
              {swatch ? (o.value ? '' : '✕') : locked && kind ? `🔒 ${o.label} Lv.${unlockLevel(kind, o.id)}` : o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function AvatarCreator({ onSaved, submitLabel }: { onSaved?: () => void; submitLabel?: string } = {}) {
  const saved = useAvatar();
  // 브라우저에서 저장된 캐릭터를 읽을 때까지 기다린 뒤, 그 값으로 폼을 시작합니다.
  if (saved === undefined) return <p className="hint" role="status">불러오는 중…</p>;
  return <CreatorForm initial={saved ?? DEFAULT_AVATAR} isEdit={saved !== null} onSaved={onSaved} submitLabel={submitLabel} />;
}

function CreatorForm({ initial, isEdit, onSaved, submitLabel }: { initial: Avatar; isEdit: boolean; onSaved?: () => void; submitLabel?: string }) {
  const router = useRouter();
  const twin = useTwinState();
  // 열린 보상은 XP 레벨로 정해집니다. 기록이 없으면 레벨 1.
  const level = twin ? growthOf(totalXp(twin.plans)).level : 1;
  const [draft, setDraft] = useState<Avatar>(initial);
  const [mood, setMood] = useState<Mood>('normal');

  const set = <K extends keyof Avatar>(field: K, id: Avatar[K]) => setDraft(d => ({ ...d, [field]: id }));
  const nameOk = draft.name.trim().length > 0;

  const submit = () => {
    if (!nameOk) return;
    saveAvatar({ ...draft, name: draft.name.trim() });
    if (onSaved) onSaved();
    else router.push('/');
  };

  return (
    <div className="creator">
      <section className="preview" aria-label="미리보기">
        <div className="stage">
          <TwinStage avatar={draft} mood={mood} height={360} />
        </div>
        <div className="mood-row" role="group" aria-label="표정 미리보기">
          {([
            ['normal', '평소'],
            ['happy', '컨디션 최고'],
            ['tired', '피곤'],
          ] as const).map(([m, label]) => (
            <button key={m} type="button" className={`mini${mood === m ? ' selected' : ''}`} onClick={() => setMood(m)}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">지금 Lv.{level}. 퀘스트를 해내서 레벨이 오르면 새 꾸미기가 열려요. (🔒 표시)</p>
        <p className="hint">앞으로 내 컨디션에 따라 쌍둥이 표정이 이렇게 바뀌어요.</p>
      </section>

      <section className="panel" aria-label="꾸미기">
        <PhotoAvatar
          onApply={partial =>
            setDraft(d => {
              // 아직 안 열린 보상은 사진으로도 고를 수 없어요.
              const next = { ...partial };
              if (next.accessory && !isUnlocked('accessory', next.accessory, level)) delete next.accessory;
              if (next.outfit && !isUnlocked('outfit', next.outfit, level)) delete next.outfit;
              if (next.ears && !isUnlocked('ears', next.ears, level)) delete next.ears;
              return { ...d, ...next };
            })
          }
        />

        <label className="name-field">
          <span>쌍둥이 이름</span>
          <input
            value={draft.name}
            maxLength={10}
            placeholder="예) 모찌, 두부, 몽이"
            onChange={e => set('name', e.target.value)}
          />
        </label>

        <Group title="몸 색" field="body" options={BODY_COLORS} avatar={draft} onChange={set} swatch />
        <Group title="체형" field="shape" options={SHAPES} avatar={draft} onChange={set} />
        <Group title="귀" field="ears" options={EARS} avatar={draft} onChange={set} kind="ears" level={level} />
        <Group title="헤어" field="hair" options={HAIRS} avatar={draft} onChange={set} kind="hair" level={level} />
        {draft.hair !== 'none' && <Group title="헤어 색" field="hairColor" options={HAIR_COLORS} avatar={draft} onChange={set} swatch />}
        <Group title="포즈" field="pose" options={POSES} avatar={draft} onChange={set} kind="pose" level={level} />
        <Group title="눈" field="eyes" options={EYES} avatar={draft} onChange={set} />
        <Group title="입" field="mouth" options={MOUTHS} avatar={draft} onChange={set} />
        <Group title="볼터치" field="blush" options={BLUSHES} avatar={draft} onChange={set} />
        <Group title="액세서리" field="accessory" options={ACCESSORIES} avatar={draft} onChange={set} kind="accessory" level={level} />
        <Group title="옷" field="outfit" options={OUTFITS} avatar={draft} onChange={set} kind="outfit" level={level} />
        {(draft.outfit !== 'none' || draft.accessory === 'scarf') && (
          <Group title="옷 색" field="outfitColor" options={OUTFIT_COLORS} avatar={draft} onChange={set} swatch />
        )}
        <Group title="배경" field="bg" options={BACKGROUNDS} avatar={draft} onChange={set} swatch />

        <div className="actions">
          <button type="button" className="btn ghost" onClick={() => setDraft(d => randomAvatar(d.name, level))}>
            🎲 랜덤
          </button>
          <button type="button" className="btn primary" disabled={!nameOk} onClick={submit}>
            {submitLabel ?? (isEdit ? '저장하기' : '저장하고 시작')}
          </button>
        </div>
        {!nameOk && <p className="hint">이름을 지어 주면 시작할 수 있어요.</p>}
      </section>
    </div>
  );
}
