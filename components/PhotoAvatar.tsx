'use client';

import { useEffect, useRef, useState } from 'react';
import { fileToJpeg, videoToJpeg } from '@/lib/image';
import type { Avatar } from '@/lib/avatar';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { twinActions } from '@/lib/twin-store';

type Message = { kind: 'ok' | 'error'; text: string };

function CameraView({ onCapture, onClose }: { onCapture: (jpeg: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      .then(s => {
        if (cancelled) return s.getTracks().forEach(t => t.stop());
        stream = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          v.play().catch(() => {});
        }
      })
      .catch(() => setError('카메라를 켤 수 없어요. 브라우저의 카메라 권한을 허용했는지 확인하거나, 사진 고르기를 이용해 주세요.'));
    if (!navigator.mediaDevices) queueMicrotask(() => setError('이 브라우저에서는 카메라를 쓸 수 없어요. 사진 고르기를 이용해 주세요.'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop()); // 카메라 끄기
    };
  }, []);

  return (
    <div className="camera" role="dialog" aria-label="사진 촬영">
      {error ? (
        <p className="msg error" role="alert">{error}</p>
      ) : (
        <video ref={videoRef} playsInline muted onLoadedData={() => setReady(true)} aria-label="카메라 미리보기" />
      )}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onClose}>닫기</button>
        {!error && (
          <button
            type="button"
            className="btn primary"
            disabled={!ready}
            onClick={() => {
              const v = videoRef.current;
              if (v) onCapture(videoToJpeg(v));
            }}
          >
            📸 찰칵
          </button>
        )}
      </div>
    </div>
  );
}

export default function PhotoAvatar({ onApply }: { onApply: (partial: Partial<Avatar>) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ai = useAiStatus();
  const aiEnabled = ai === null ? null : ai.enabled;

  const take = (jpeg: string) => {
    setPhoto(jpeg);
    setCamera(false);
    setConsent(false);
    setMessage(null);
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''; // 같은 사진을 다시 고를 수 있게
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      setMessage({ kind: 'error', text: '20MB 이하의 사진 파일만 고를 수 있어요.' });
      return;
    }
    try {
      take(await fileToJpeg(file));
    } catch {
      setMessage({ kind: 'error', text: '이 사진은 읽을 수 없어요. 다른 사진(JPG·PNG)을 골라 주세요.' });
    }
  };

  const analyze = async () => {
    if (!photo || !consent) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/avatar-from-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: photo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; ok?: boolean; reason?: string; avatar?: Partial<Avatar>; meta?: { model?: string; ms?: number; promptVersion?: string } };
      twinActions.addTrace({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        kind: 'photo',
        ok: res.ok && !data.error,
        error: res.ok && !data.error ? undefined : (data.code ?? `http_${res.status}`),
        model: data.meta?.model,
        promptVersion: data.meta?.promptVersion,
        ms: data.meta?.ms,
        inputKinds: ['얼굴 사진 1장(저장하지 않음)'],
        input: { note: '사진은 이 기기와 서버에 저장하지 않아요. 분석을 위해 OpenAI로 한 번 전송돼요.' },
      });
      if (!res.ok || data.error) {
        setMessage({ kind: 'error', text: data.error ?? 'AI 분석에 실패했어요. 다시 시도해 주세요.' });
      } else if (!data.ok || !data.avatar) {
        setMessage({ kind: 'error', text: '사진에서 사람을 찾지 못했어요. 얼굴과 옷이 잘 보이는 사진으로 다시 해 보세요.' });
      } else {
        onApply(data.avatar);
        setMessage({ kind: 'ok', text: data.reason ? `이렇게 골랐어요: ${data.reason}` : '사진에 어울리게 캐릭터를 꾸몄어요. 마음대로 더 바꿔 보세요!' });
        setPhoto(null); // 분석이 끝나면 사진은 바로 버립니다.
        setConsent(false);
      }
    } catch {
      setMessage({ kind: 'error', text: '네트워크 문제로 보내지 못했어요. 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  };

  // 확인 중에는 아무것도 보이지 않고, AI가 연결되지 않았다면 이유를 알려 주는 안내 한 줄만 보여 줍니다.
  if (aiEnabled === null) return null;
  if (!aiEnabled)
    return (
      <p className="photo-off" role="note">
        <span aria-hidden="true">📷</span> 사진으로 만들기는 지금 쓸 수 없어요. (AI가 아직 연결되지 않았어요) 아래에서 직접 꾸며 보세요.
      </p>
    );

  return (
    <section className="photo-box" aria-label="사진으로 캐릭터 만들기">
      <h3>📷 사진으로 만들기</h3>
      <p className="muted small">사진 속 안경·머리·옷·표정을 보고 어울리는 캐릭터로 자동 설정해요.</p>

      {camera ? (
        <CameraView onCapture={take} onClose={() => setCamera(false)} />
      ) : (
        <div className="actions left">
          <button type="button" className="btn ghost small" onClick={() => setCamera(true)}>📸 사진 찍기</button>
          <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()}>🖼️ 사진 고르기</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
        </div>
      )}

      {photo && !camera && (
        <div className="photo-preview">
          {/* 사진은 이 기기 화면에만 보이고, 분석이 끝나면 지워져요. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="선택한 사진 미리보기" />
          <label className="toggle">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>이 사진을 OpenAI(AI)에 보내 캐릭터 꾸미기 옵션을 고르는 데에만 쓰는 것에 동의해요.</span>
          </label>
          <details className="privacy">
            <summary>사진은 어떻게 처리되나요?</summary>
            <ul>
              <li>사진은 이 기기에서 작게 줄여(긴 변 768px) 위치 정보 같은 메타데이터를 없앤 뒤 보내요.</li>
              <li><b>외부 전송:</b> 분석을 위해 OpenAI로 한 번 전송돼요. 사진을 OpenAI에서 얼마나 보관하는지는 OpenAI의 데이터 정책을 따르며, 이 앱이 정할 수 없어요.</li>
              <li><b>이 앱의 보관:</b> 서버와 브라우저에 사진을 저장하지 않아요. 분석이 끝나면 화면에서도 바로 지워요. (그래서 따로 삭제할 사진이 남지 않아요.)</li>
              <li>안경·머리·옷·표정 같은 겉모습만 참고해요. 건강 상태나 피부·눈의 상태를 진단하거나 추정하지 않아요.</li>
              <li>전송 기록(시각·모델·소요 시간, 사진 내용 제외)은 AI TRACE에서 볼 수 있어요.</li>
            </ul>
          </details>
          <div className="actions left">
            <button type="button" className="btn primary small" disabled={!consent || busy} onClick={analyze}>
              {busy ? '분석 중…' : '✨ AI로 내 캐릭터 만들기'}
            </button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setPhoto(null); setConsent(false); }}>
              사진 지우기
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`msg ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
