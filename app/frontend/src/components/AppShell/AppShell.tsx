import styles from './AppShell.module.css';
import { useCapabilities } from '../../capabilities/useCapabilities';
import { PhoneLayout } from '../PhoneLayout/PhoneLayout';
import { DesktopLayout } from '../DesktopLayout/DesktopLayout';
import { useState } from 'react';
import type { AppView } from '../ViewMenu/ViewMenu';
import { Composer } from '../Composer/Composer';
import { Library } from '../Library/Library';

export function AppShell() {
  const { mode } = useCapabilities();
  const [view, setView] = useState<AppView>('compose');
  const content = (
    <>
      <section className={styles.view} hidden={view !== 'compose'} aria-label="Composer">
        <Composer />
      </section>
      <section className={styles.view} hidden={view !== 'library'} aria-label="Library">
        <h1 className={styles.title}>Library</h1>
        <Library />
      </section>
    </>
  );

  return (
    <main className={styles.shell}>
      {mode === 'phone' ? (
        <PhoneLayout view={view} onViewChange={setView}>{content}</PhoneLayout>
      ) : (
        <DesktopLayout>{content}</DesktopLayout>
      )}
    </main>
  );
}
