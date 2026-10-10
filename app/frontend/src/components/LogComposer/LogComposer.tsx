import { useEffect, useRef, useState } from 'react';
import type { LogDraft, PendingAttachment } from '../../media/types';
import { prepareAttachment } from '../../media/files';
import {
  MAX_LOG_ATTACHMENTS,
  MAX_LOG_BYTES,
} from '../../domain/logs/validation';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { LogMedia } from '../LogMedia/LogMedia';
import styles from './LogComposer.module.css';
import ui from '../../styles/controls.module.css';

/** No task/store dependency: the parent decides where a submitted log belongs. */
export function LogComposer({
  onSave,
  onBusyChange,
  disabled = false,
}: {
  onSave: (draft: LogDraft) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photos = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const attach = async (files: (Blob & { name?: string })[]) => {
    if (!files.length) return;
    setPreparing(true);
    setError('');
    try {
      if (attachments.length + files.length > MAX_LOG_ATTACHMENTS)
        throw new Error('A log can contain up to 12 attachments.');
      if (
        attachments.reduce((sum, file) => sum + file.metadata.size, 0) +
          files.reduce((sum, file) => sum + file.size, 0) >
        MAX_LOG_BYTES
      )
        throw new Error('A log can contain up to 50 MB of media.');
      const prepared: PendingAttachment[] = [];
      for (const file of files) prepared.push(await prepareAttachment(file));
      if (mounted.current)
        setAttachments((current) => [...current, ...prepared]);
    } finally {
      if (mounted.current) setPreparing(false);
    }
  };
  const recorder = useAudioRecorder(async (file) => {
    await attach([file]);
  });
  const ownBusy = preparing || saving || recorder.phase !== 'idle';
  const locked = disabled || ownBusy;
  useEffect(() => {
    onBusyChange?.(ownBusy);
  }, [ownBusy, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const choose = async (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = '';
    try {
      await attach(files);
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error ? error.message : 'Unable to attach files.',
        );
    }
  };
  return (
    <form
      className={styles.composer}
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked) return;
        setSaving(true);
        setError('');
        try {
          await onSave({ text, attachments });
          if (mounted.current) {
            setText('');
            setAttachments([]);
          }
        } catch (error) {
          if (mounted.current)
            setError(
              error instanceof Error && error.name === 'QuotaExceededError'
                ? 'Not enough device storage. Try smaller files; your draft is still here.'
                : error instanceof Error
                  ? error.message
                  : 'Unable to save log.',
            );
        } finally {
          if (mounted.current) setSaving(false);
        }
      }}
    >
      <label className={ui.field}>
        Write a log
        <textarea
          value={text}
          disabled={locked}
          maxLength={100000}
          placeholder="What happened? Text is optional when you attach media."
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <input
        ref={photos}
        hidden
        type="file"
        accept="image/*"
        multiple
        aria-label="Choose images"
        onChange={(event) => void choose(event.currentTarget)}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take a photo"
        onChange={(event) => void choose(event.currentTarget)}
      />
      <input
        ref={audio}
        hidden
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm,.flac"
        multiple
        aria-label="Choose audio files"
        onChange={(event) => void choose(event.currentTarget)}
      />
      <div className={ui.row}>
        <button
          type="button"
          className={styles.attach}
          disabled={locked}
          onClick={() => photos.current?.click()}
        >
          ＋ Photos
        </button>
        <button
          type="button"
          className={styles.attach}
          disabled={locked}
          onClick={() => camera.current?.click()}
        >
          Camera
        </button>
        <button
          type="button"
          className={styles.attach}
          disabled={locked}
          onClick={() => audio.current?.click()}
        >
          ＋ Audio
        </button>
        {recorder.phase === 'idle' && (
          <button
            type="button"
            className={styles.attach}
            disabled={locked || !recorder.supported}
            title={
              recorder.supported
                ? 'Record using the microphone'
                : 'Recording needs HTTPS and microphone support'
            }
            onClick={() => void recorder.start()}
          >
            ● Record
          </button>
        )}
      </div>
      {recorder.phase !== 'idle' && (
        <div className={styles.recording}>
          <span role="status">
            {recorder.phase === 'requesting'
              ? 'Waiting for microphone permission…'
              : recorder.phase === 'stopping'
                ? 'Preparing recording…'
                : `Recording ${Math.floor(recorder.elapsed / 60)}:${String(recorder.elapsed % 60).padStart(2, '0')}`}
          </span>
          <div className={ui.row}>
            {recorder.phase === 'recording' && (
              <button
                type="button"
                className={ui.button}
                onClick={recorder.stop}
              >
                Stop and attach
              </button>
            )}
            {recorder.phase !== 'stopping' && (
              <button
                type="button"
                className={styles.attach}
                onClick={recorder.cancel}
              >
                Discard recording
              </button>
            )}
          </div>
        </div>
      )}
      {attachments.length > 0 && (
        <div className={styles.previews}>
          {attachments.map((file) => (
            <LogMedia
              key={file.metadata.id}
              attachment={file.metadata}
              blob={file.blob}
              disabled={locked}
              onRemove={() =>
                setAttachments((current) =>
                  current.filter(
                    (value) => value.metadata.id !== file.metadata.id,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
      <small className={ui.muted}>
        {preparing
          ? 'Preparing attachments…'
          : 'Images and audio stay on this device. Up to 20 MB per file.'}
      </small>
      {(error || recorder.error) && (
        <p className={ui.error} role="alert">
          {error || recorder.error}
        </p>
      )}
      {recorder.message && (
        <p className={ui.muted} role="status">
          {recorder.message}
        </p>
      )}
      <button
        type="submit"
        className={`${ui.button} ${ui.primary}`}
        disabled={locked || (!text.trim() && !attachments.length)}
      >
        {saving ? 'Saving…' : 'Save log'}
      </button>
    </form>
  );
}
