import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'requesting' | 'recording' | 'stopping';
interface Session {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  discard: boolean;
}

/** Records only while this UI is active; every exit releases the microphone. */
export function useAudioRecorder(
  onRecorded: (file: Blob & { name: string }) => Promise<void>,
) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currentPhase = useRef<Phase>('idle');
  const session = useRef<Session | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const startedAt = useRef(0);
  const callback = useRef(onRecorded);
  callback.current = onRecorded;
  const changePhase = useCallback((next: Phase) => {
    currentPhase.current = next;
    if (mounted.current) setPhase(next);
  }, []);
  const release = (value: Session) =>
    value.stream.getTracks().forEach((track) => track.stop());
  const stop = useCallback(() => {
    const value = session.current;
    if (!value || value.recorder.state === 'inactive') return;
    changePhase('stopping');
    value.recorder.stop();
    release(value);
  }, [changePhase]);
  const cancel = useCallback(() => {
    generation.current++;
    const value = session.current;
    if (value) {
      value.discard = true;
      if (value.recorder.state !== 'inactive') value.recorder.stop();
      release(value);
      session.current = null;
    }
    changePhase('idle');
  }, [changePhase]);
  const supported =
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    window.isSecureContext !== false;
  const start = async () => {
    if (!supported || currentPhase.current !== 'idle') return;
    setError('');
    setMessage('');
    setElapsed(0);
    changePhase('requesting');
    const token = ++generation.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000,
      });
      const value: Session = { recorder, stream, chunks: [], discard: false };
      session.current = value;
      recorder.ondataavailable = (event) => {
        if (event.data.size) value.chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (mounted.current)
          setError('Recording failed. You can attach an audio file instead.');
        cancel();
      };
      recorder.onstop = async () => {
        release(value);
        if (value.discard || !mounted.current || token !== generation.current)
          return;
        changePhase('stopping');
        try {
          const type = (
            recorder.mimeType ||
            mimeType ||
            value.chunks[0]?.type ||
            'audio/mp4'
          ).split(';')[0];
          const extension = type.includes('mp4')
            ? 'm4a'
            : type.includes('ogg')
              ? 'ogg'
              : 'webm';
          const file = Object.assign(new Blob(value.chunks, { type }), {
            name: `Recording-${new Date(startedAt.current).toISOString().replace(/[:.]/g, '-')}.${extension}`,
          });
          await callback.current(file);
        } catch (error) {
          if (mounted.current)
            setError(
              error instanceof Error
                ? error.message
                : 'Unable to attach recording.',
            );
        } finally {
          value.chunks = [];
          if (session.current === value) session.current = null;
          if (token === generation.current) changePhase('idle');
        }
      };
      startedAt.current = Date.now();
      recorder.start(1000);
      changePhase('recording');
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (!mounted.current || token !== generation.current) return;
      session.current = null;
      setError(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was not allowed. You can attach an audio file instead.'
          : 'Unable to start the microphone. You can attach an audio file instead.',
      );
      changePhase('idle');
    }
  };
  useEffect(() => {
    if (phase !== 'recording') return;
    const tick = () => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= 600) {
        setMessage('Recording stopped at 10 minutes.');
        stop();
      }
    };
    const timer = window.setInterval(tick, 250);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setMessage('Recording stopped when the app went into the background.');
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, stop]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);
  return { supported, phase, elapsed, message, error, start, stop, cancel };
}
