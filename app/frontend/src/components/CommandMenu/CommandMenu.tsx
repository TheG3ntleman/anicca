import type { BoxDefinition } from '../../document/types';
import styles from './CommandMenu.module.css';

export function CommandMenu({ left, top, limited, maxDepth, options, selectedIndex, onSelect }: {
  left: number; top: number; limited: boolean; maxDepth: number;
  options: BoxDefinition[]; selectedIndex: number; onSelect: (definition: BoxDefinition) => void;
}) {
  return (
    <div className={styles.menu} style={{ left, top }} role="group" aria-label="Insert box">
      <div className={styles.options}>
        {options.map((definition, index) => (
          <button key={definition.id} type="button" className={styles.option} disabled={limited}
            data-selected={index === selectedIndex}
            onPointerDown={(event) => event.preventDefault()} onClick={() => onSelect(definition)}>
            {definition.label ?? definition.selector} <span className={styles.selector}>@{definition.selector}</span>
          </button>
        ))}
      </div>
      <div className={styles.hint} role="status">
        {limited ? `Maximum nesting depth (${maxDepth}) reached.` : '↑↓ to choose · Enter to insert · Esc to dismiss'}
      </div>
    </div>
  );
}
