import type { ReactNode } from 'react';
import styles from './DesktopLayout.module.css';

export function DesktopLayout({ children }: { children: ReactNode }) {
  return <div className={styles.layout} data-mode="desktop">{children}</div>;
}
