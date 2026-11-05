'use client';

import { useEffect, useRef, useState } from 'react';
import { fileToJpeg, videoToJpeg } from '@/lib/image';
import type { Avatar } from '@/lib/avatar';
import { useAiEnabled } from '@/lib/use-ai-enabled';

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
  const aiEnabled = useAiEnabled();

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
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; reason?: string; avatar?: Partial<Avatar> };
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

  // AI 키가 설정되지 않았다면 이 기능은 보이지 않습니다. (확인 중일 때도 숨김)
  if (!aiEnabled) return null;

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
            <span>이 사진을 AI(Claude)에 보내 캐릭터 설정을 만드는 데에만 쓰는 것에 동의해요. 사진은 저장되지 않아요.</span>
          </label>
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
