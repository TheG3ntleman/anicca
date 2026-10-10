import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '../../domain/logs/types';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { formatBytes } from '../../media/files';
import { Modal } from '../Modal/Modal';
import styles from './LogMedia.module.css';
import ui from '../../styles/controls.module.css';

export function LogMedia({
  attachment,
  blob,
  onRemove,
  disabled = false,
}: {
  attachment: Attachment;
  blob: Blob;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const url = useObjectUrl(blob);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <figure className={styles.card}>
      {url &&
        (attachment.kind === 'image' ? (
          failed ? (
            <p className={ui.muted}>
              Preview unavailable. The original file is retained.
            </p>
          ) : (
            <button
              type="button"
              className={styles.imageButton}
              aria-label={`View ${attachment.name}`}
              disabled={disabled}
              onClick={() => setExpanded(true)}
            >
              <img
                className={styles.thumbnail}
                src={url}
                alt={attachment.name}
                loading="lazy"
                onError={() => setFailed(true)}
              />
            </button>
          )
        ) : (
          <audio
            className={styles.audio}
            src={url}
            controls
            preload="metadata"
            aria-label={attachment.name}
            onError={() => setFailed(true)}
          />
        ))}
      {failed && attachment.kind === 'audio' && (
        <p className={ui.muted}>
          This browser cannot play the file. You can save the original.
        </p>
      )}
      <figcaption className={styles.caption}>
        <span className={styles.name}>
          {attachment.name}
          <small>{formatBytes(attachment.size)}</small>
        </span>
        {onRemove ? (
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${attachment.name}`}
            disabled={disabled}
            onClick={onRemove}
          >
            ×
          </button>
        ) : (
          url && (
            <a
              href={url}
              download={attachment.name}
              className={styles.download}
            >
              Save file
            </a>
          )
        )}
      </figcaption>
      {expanded && url && (
        <Modal title={attachment.name} onClose={() => setExpanded(false)}>
          <img className={styles.original} src={url} alt={attachment.name} />
          <a href={url} download={attachment.name} className={styles.download}>
            Save original
          </a>
        </Modal>
      )}
    </figure>
  );
}

export function StoredLogMedia({
  attachment,
  loadMedia,
}: {
  attachment: Attachment;
  loadMedia: (attachment: Attachment) => Promise<Blob | undefined>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === 'undefined',
  );
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(element.current!);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setBlob(null);
    setError('');
    loadMedia(attachment)
      .then((value) => {
        if (!active) return;
        if (value) setBlob(value);
        else setError('This attachment is missing from local storage.');
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load attachment.',
          );
      });
    return () => {
      active = false;
    };
  }, [attachment.sha256, attachment.mimeType, loadMedia, visible]);
  return (
    <div ref={element} className={!blob ? styles.placeholder : undefined}>
      {blob ? (
        <LogMedia key={attachment.sha256} attachment={attachment} blob={blob} />
      ) : (
        <p
          className={error ? ui.error : ui.muted}
          role={error ? 'alert' : 'status'}
        >
          {error || `Loading ${attachment.name}…`}
        </p>
      )}
    </div>
  );
}
