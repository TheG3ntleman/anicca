import type { ReactNode } from 'react';
import styles from './PhoneLayout.module.css';
import { ViewMenu, type AppView } from '../ViewMenu/ViewMenu';

export function PhoneLayout({ children, view, onViewChange }: {
  children: ReactNode;
  view: AppView;
  onViewChange: (view: AppView) => void;
}) {
  return (
    <div className={styles.layout} data-mode="phone">
      <ViewMenu view={view} onViewChange={onViewChange} />
      {children}
    </div>
  );
}
