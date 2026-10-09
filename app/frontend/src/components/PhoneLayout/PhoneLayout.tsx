import type { ReactNode } from 'react';
import styles from './PhoneLayout.module.css';

export function PhoneLayout({ children }: { children: ReactNode }) {
  return <div className={styles.layout} data-mode="phone">{children}</div>;
}
