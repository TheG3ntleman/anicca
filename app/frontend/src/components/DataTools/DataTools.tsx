import { useRef, useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import type {
  PlanningExport,
  ConflictChoices,
  ImportConflict,
} from '../../domain/transfer/types';
import { parseExport } from '../../domain/transfer/validation';
import { importConflicts } from '../../domain/transfer/merge';
import { localDate } from '../../domain/tasks/dates';
import { Modal } from '../Modal/Modal';
import ui from '../../styles/controls.module.css';
export function DataTools({
  store,
  onClose,
}: {
  store: PlanningStore;
  onClose: () => void;
}) {
  const [incoming, setIncoming] = useState<PlanningExport | null>(null);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [choices, setChoices] = useState<ConflictChoices>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const exportData = async () => {
    setBusy(true);
    setError('');
    try {
      const snapshot = await store.export();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anicca-${localDate()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(
        'Export prepared. On iPhone, save the downloaded file to Files.',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to export.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Data & backups" onClose={onClose} locked={busy}>
      <div className={ui.stack}>
        <p className={ui.muted}>
          Your tasks, notes, and review history stay in this browser. Keep
          exports as backups; deleting browser data can remove local records.
        </p>
        <button
          className={`${ui.button} ${ui.primary}`}
          disabled={busy}
          onClick={() => void exportData()}
        >
          Export complete database
        </button>
        <input
          ref={picker}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setBusy(true);
            setError('');
            setMessage('');
            try {
              if (file.size > 50 * 1024 * 1024)
                throw new Error('Choose an export smaller than 50 MB.');
              const data = parseExport(await file.text());
              const local = await store.export();
              const conflicts = importConflicts(local, data);
              setIncoming(data);
              setConflicts(conflicts);
              setChoices(
                Object.fromEntries(
                  conflicts.map((conflict) => [conflict.key, 'local']),
                ),
              );
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : 'Unable to read this file.',
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          Choose export to import
        </button>
        {incoming && (
          <section className={ui.stack}>
            <p>
              {incoming.tasks.length} tasks · {incoming.notes.length} notes ·{' '}
              {incoming.events.length} history records ·{' '}
              {incoming.reviews.length} completed reviews
            </p>
            <p className={ui.muted}>
              Import merges records by ID. Existing records are not deleted.
            </p>
            {conflicts.map((conflict) => (
              <label key={conflict.key} className={ui.field}>
                Conflict · {conflict.collection} ·{' '}
                {'title' in conflict.incoming
                  ? conflict.incoming.title
                  : conflict.incoming.id}
                <select
                  value={choices[conflict.key]}
                  onChange={(event) =>
                    setChoices((choices) => ({
                      ...choices,
                      [conflict.key]: event.target.value as
                        'local' | 'incoming',
                    }))
                  }
                >
                  <option value="local">Keep current version</option>
                  <option value="incoming">Use imported version</option>
                </select>
                <details>
                  <summary>Compare versions</summary>
                  <pre
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    Current: {JSON.stringify(conflict.local, null, 2)}
                    {'\n'}Imported: {JSON.stringify(conflict.incoming, null, 2)}
                  </pre>
                </details>
              </label>
            ))}
            <button
              className={`${ui.button} ${ui.primary}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await store.import(incoming, choices);
                  setIncoming(null);
                  setMessage(
                    'Import complete. Your records are saved locally.',
                  );
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : 'Import failed; no changes were saved.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Importing…' : 'Confirm merge'}
            </button>
          </section>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
