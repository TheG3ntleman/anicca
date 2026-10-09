import styles from './AppShell.module.css';
import { useCapabilities } from '../../capabilities/useCapabilities';
import { PhoneLayout } from '../PhoneLayout/PhoneLayout';
import { DesktopLayout } from '../DesktopLayout/DesktopLayout';

export function AppShell() {
  const { mode } = useCapabilities();
  const Layout = mode === 'desktop' ? DesktopLayout : PhoneLayout;

  return (
    <main className={styles.shell}>
      <Layout>
        <h1 className={styles.title}>Anicca</h1>
      </Layout>
    </main>
  );
}
