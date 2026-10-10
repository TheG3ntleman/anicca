import styles from './AppShell.module.css';
import { useCapabilities } from '../../capabilities/useCapabilities';
import { PhoneLayout } from '../PhoneLayout/PhoneLayout';
import { DesktopLayout } from '../DesktopLayout/DesktopLayout';
import { Planning } from '../Planning/Planning';
import { planningStore } from '../../state/appStore';

export function AppShell() {
  const { mode } = useCapabilities();
  const Layout = mode === 'desktop' ? DesktopLayout : PhoneLayout;
  return (
    <main className={styles.shell}>
      <Layout>
        <Planning store={planningStore} />
      </Layout>
    </main>
  );
}
