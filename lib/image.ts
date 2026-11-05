// 사진을 작은 JPEG로 줄입니다. (전송량을 줄이고, 위치 정보 같은 메타데이터도 함께 사라집니다)
const MAX_SIDE = 768;

function draw(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** 갤러리에서 고른 사진 파일 → 작은 JPEG data URL */
export async function fileToJpeg(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file); // 사진의 회전 정보를 반영해서 읽습니다.
  try {
    return draw(bmp, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}

/** 카메라 화면의 현재 프레임 → 작은 JPEG data URL */
export function videoToJpeg(video: HTMLVideoElement): string {
  return draw(video, video.videoWidth, video.videoHeight);
}
