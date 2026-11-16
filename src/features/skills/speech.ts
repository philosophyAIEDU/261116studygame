// 음성 인식(Web Speech SpeechRecognition)과 녹음(MediaRecorder) 래퍼.
// 마이크 권한은 이 함수들을 처음 부를 때(= 말하기 퀘스트에 들어갔을 때)만 요청된다.
// 녹음은 메모리에만 두고 기기에 저장하지 않는다.

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenHandle {
  /** 인식된 최종 문장 (실패·취소 시 빈 문자열) */
  result: Promise<string>;
  /** 지금까지 들은 것으로 마무리한다 */
  stop: () => void;
}

/**
 * 영어 한 마디를 듣는다.
 * @param onInterim 중간 결과 (말풍선에 실시간 표시)
 * @param silenceMs 말이 끝난 뒤 이만큼 조용하면 자동으로 마무리 (0 이면 사용 안 함)
 */
export function listenOnce(opts: { onInterim?: (text: string) => void; silenceMs?: number; maxMs?: number } = {}): ListenHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.resolve(''), stop: () => {} };
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  let finalText = '';
  let interim = '';
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveResult: (text: string) => void = () => {};
  const result = new Promise<string>((resolve) => { resolveResult = resolve; });
  const maxTimer = setTimeout(() => { try { rec.stop(); } catch { finish(); } }, opts.maxMs ?? 15000);

  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r) continue;
      if (r.isFinal) finalText += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    opts.onInterim?.(`${finalText}${interim}`.trim());
    if (opts.silenceMs && opts.silenceMs > 0) {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { try { rec.stop(); } catch { finish(); } }, opts.silenceMs);
    }
  };
  const finish = () => {
    clearTimeout(maxTimer);
    if (silenceTimer) clearTimeout(silenceTimer);
    resolveResult(`${finalText}${interim}`.trim());
  };
  rec.onerror = () => { finish(); try { rec.abort(); } catch { /* 이미 끝남 */ } };
  rec.onend = finish;
  try {
    rec.start();
  } catch {
    finish();
  }
  return { result, stop: () => { try { rec.stop(); } catch { finish(); } } };
}

export function recorderSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export interface RecordHandle {
  /** 녹음 결과 (실패 시 null). 메모리에만 있고 저장하지 않는다. */
  clip: Promise<Blob | null>;
  stop: () => void;
}

/** 짧은 녹음 (다시 듣기·자기 평가, 또는 보호자 동의 시 Gemini 전송용). 최대 길이를 넘으면 자동으로 멈춘다. */
export function recordClip(maxSeconds: number): RecordHandle {
  if (!recorderSupported()) return { clip: Promise.resolve(null), stop: () => {} };
  let recorder: MediaRecorder | null = null;
  let stopped = false;
  const clip = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(
      (stream) =>
        new Promise<Blob | null>((resolve) => {
          const chunks: Blob[] = [];
          let timer: ReturnType<typeof setTimeout> | undefined;
          const finish = (blob: Blob | null) => {
            if (timer) clearTimeout(timer);
            stream.getTracks().forEach((track) => track.stop());
            resolve(blob);
          };
          try {
            recorder = new MediaRecorder(stream);
            timer = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, maxSeconds * 1000);
            recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
            recorder.onstop = () => finish(chunks.length > 0 ? new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }) : null);
            recorder.onerror = () => { finish(null); if (recorder?.state === 'recording') recorder.stop(); };
            recorder.start();
            if (stopped) recorder.stop();
          } catch {
            finish(null);
          }
        }),
    )
    .catch(() => null);
  return {
    clip,
    stop: () => {
      stopped = true;
      if (recorder && recorder.state === 'recording') recorder.stop();
    },
  };
}

/** Blob → base64 (Gemini inlineData 용) */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}
