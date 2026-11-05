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
  MOUTHS,
  OUTFITS,
  OUTFIT_COLORS,
  SHAPES,
  randomAvatar,
  type Avatar,
  type Mood,
} from '@/lib/avatar';
import { saveAvatar, useAvatar } from '@/lib/avatar-store';

type Option = { id: string; label: string; value?: string };

function Group<K extends keyof Avatar>({
  title,
  field,
  options,
  avatar,
  onChange,
  swatch = false,
}: {
  title: string;
  field: K;
  options: readonly Option[];
  avatar: Avatar;
  onChange: (field: K, id: Avatar[K]) => void;
  swatch?: boolean;
}) {
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      <div className="chips" role="radiogroup" aria-label={title}>
        {options.map(o => {
          const selected = avatar[field] === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.label}
              title={o.label}
              className={`chip${swatch ? ' swatch' : ''}${selected ? ' selected' : ''}`}
              style={swatch && o.value ? { background: o.value } : undefined}
              onClick={() => onChange(field, o.id as Avatar[K])}
            >
              {swatch ? (o.value ? '' : '✕') : o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function AvatarCreator() {
  const saved = useAvatar();
  // 브라우저에서 저장된 캐릭터를 읽을 때까지 기다린 뒤, 그 값으로 폼을 시작합니다.
  if (saved === undefined) return <p className="hint" role="status">불러오는 중…</p>;
  return <CreatorForm initial={saved ?? DEFAULT_AVATAR} isEdit={saved !== null} />;
}

function CreatorForm({ initial, isEdit }: { initial: Avatar; isEdit: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Avatar>(initial);
  const [mood, setMood] = useState<Mood>('normal');

  const set = <K extends keyof Avatar>(field: K, id: Avatar[K]) => setDraft(d => ({ ...d, [field]: id }));
  const nameOk = draft.name.trim().length > 0;

  const submit = () => {
    if (!nameOk) return;
    saveAvatar({ ...draft, name: draft.name.trim() });
    router.push('/');
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
        <p className="hint">앞으로 내 컨디션에 따라 쌍둥이 표정이 이렇게 바뀌어요.</p>
      </section>

      <section className="panel" aria-label="꾸미기">
        <PhotoAvatar onApply={partial => setDraft(d => ({ ...d, ...partial }))} />

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
        <Group title="귀" field="ears" options={EARS} avatar={draft} onChange={set} />
        <Group title="눈" field="eyes" options={EYES} avatar={draft} onChange={set} />
        <Group title="입" field="mouth" options={MOUTHS} avatar={draft} onChange={set} />
        <Group title="볼터치" field="blush" options={BLUSHES} avatar={draft} onChange={set} />
        <Group title="액세서리" field="accessory" options={ACCESSORIES} avatar={draft} onChange={set} />
        <Group title="옷" field="outfit" options={OUTFITS} avatar={draft} onChange={set} />
        {(draft.outfit !== 'none' || draft.accessory === 'scarf') && (
          <Group title="옷 색" field="outfitColor" options={OUTFIT_COLORS} avatar={draft} onChange={set} swatch />
        )}
        <Group title="배경" field="bg" options={BACKGROUNDS} avatar={draft} onChange={set} swatch />

        <div className="actions">
          <button type="button" className="btn ghost" onClick={() => setDraft(d => randomAvatar(d.name))}>
            🎲 랜덤
          </button>
          <button type="button" className="btn primary" disabled={!nameOk} onClick={submit}>
            {isEdit ? '저장하기' : '저장하고 시작'}
          </button>
        </div>
        {!nameOk && <p className="hint">이름을 지어 주면 시작할 수 있어요.</p>}
      </section>
    </div>
  );
}
