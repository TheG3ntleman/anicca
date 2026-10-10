import type { Attachment, Log } from '../../domain/logs/types';
import { StoredLogMedia } from '../LogMedia/LogMedia';
import styles from './LogViewer.module.css';
import ui from '../../styles/controls.module.css';

export function LogViewer({
  log,
  attachments,
  loadMedia,
}: {
  log: Log;
  attachments: Attachment[];
  loadMedia: (attachment: Attachment) => Promise<Blob | undefined>;
}) {
  const byId = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  );
  return (
    <article className={styles.log}>
      <time className={ui.muted} dateTime={log.createdAt}>
        {new Date(log.createdAt).toLocaleString()}
      </time>
      {log.text && <p className={styles.text}>{log.text}</p>}
      {log.attachmentIds.length > 0 && (
        <div className={styles.media}>
          {log.attachmentIds.map((id) => {
            const attachment = byId.get(id);
            return attachment ? (
              <StoredLogMedia
                key={id}
                attachment={attachment}
                loadMedia={loadMedia}
              />
            ) : (
              <p key={id} className={ui.error}>
                Attachment metadata is missing.
              </p>
            );
          })}
        </div>
      )}
    </article>
  );
}
