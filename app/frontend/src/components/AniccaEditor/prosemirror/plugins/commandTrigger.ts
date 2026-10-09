import type { BoxDefinition } from '../../../../document/types';
import type { BoxRegistry } from '../../../../document/boxRegistry';
import { Plugin, PluginKey } from 'prosemirror-state';
import { boxDepth, findBoxTrigger, insertBox, lineBreakInBox, type BoxTrigger } from '../commands';

export interface CommandMenuState extends BoxTrigger { left: number; top: number; limited: boolean; options: BoxDefinition[]; selectedIndex: number }
export const triggerKey = new PluginKey<{ dismissed: boolean; index: number }>('anicca-command-trigger');

export function commandTrigger(getMaxDepth: () => number, onMenu: (menu: CommandMenuState | null) => void, getRegistry: () => BoxRegistry) {
  return new Plugin<{ dismissed: boolean; index: number }>({
    key: triggerKey,
    state: {
      init: () => ({ dismissed: false, index: 0 }),
      apply(transaction, dismissed) {
        if (transaction.getMeta('anicca-dismiss-trigger')) return { dismissed: true, index: 0 };
        const index = transaction.getMeta('anicca-command-index');
        if (typeof index === 'number') return { dismissed: false, index };
        return transaction.docChanged || transaction.selectionSet ? { dismissed: false, index: 0 } : dismissed;
      },
    },
    props: {
      handleDOMEvents: {
        beforeinput(view, event) {
          const input = event as InputEvent;
          if (input.isComposing || !['insertParagraph', 'insertLineBreak'].includes(input.inputType)) return false;
          const trigger = !triggerKey.getState(view.state)?.dismissed ? findBoxTrigger(view.state) : null;
          const options = trigger ? getRegistry().matching(trigger.query) : [];
          if (trigger && options.length) {
            const index = triggerKey.getState(view.state)?.index ?? 0;
            if (boxDepth(view.state) < getMaxDepth()) insertBox(trigger, options[index] ?? options[0], getMaxDepth())(view.state, view.dispatch);
          } else if (!lineBreakInBox(view.state, view.dispatch)) return false;
          event.preventDefault();
          return true;
        },
      },
      handleKeyDown(view, event) {
        if (event.isComposing || triggerKey.getState(view.state)?.dismissed) return false;
        const trigger = findBoxTrigger(view.state);
        const options = trigger ? getRegistry().matching(trigger.query) : [];
        if (!trigger || !options.length) return false;
        if (event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta('anicca-dismiss-trigger', true));
          return true;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const index = triggerKey.getState(view.state)?.index ?? 0;
          view.dispatch(view.state.tr.setMeta('anicca-command-index', (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length));
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          // Consume the command key at the limit without introducing unexpected text.
          if (boxDepth(view.state) < getMaxDepth()) insertBox(trigger, options[triggerKey.getState(view.state)?.index ?? 0] ?? options[0], getMaxDepth())(view.state, view.dispatch);
          return true;
        }
        return false;
      },
    },
    view(view) {
      const update = () => {
        const trigger = !triggerKey.getState(view.state)?.dismissed && !view.composing ? findBoxTrigger(view.state) : null;
        const options = trigger ? getRegistry().matching(trigger.query) : [];
        if (!trigger || !options.length) { onMenu(null); return; }
        const caret = view.coordsAtPos(trigger.to);
        const host = view.dom.parentElement!;
        const bounds = host.getBoundingClientRect();
        const width = Math.min(230, bounds.width - 16);
        onMenu({ ...trigger, options, selectedIndex: triggerKey.getState(view.state)?.index ?? 0,
          left: Math.max(8, Math.min(caret.left - bounds.left, bounds.width - width - 8)),
          top: caret.bottom + 220 > bounds.bottom
            ? Math.max(8, caret.top - bounds.top - 210)
            : caret.bottom - bounds.top + 6,
          limited: boxDepth(view.state) >= getMaxDepth(),
        });
      };
      // Keep the menu attached to the caret when the editor scrolls.
      view.dom.parentElement?.addEventListener('scroll', update);
      const viewport = window.visualViewport;
      viewport?.addEventListener('resize', update);
      window.addEventListener('resize', update);
      update();
      return {
        update,
        destroy() {
          view.dom.parentElement?.removeEventListener('scroll', update);
          viewport?.removeEventListener('resize', update);
          window.removeEventListener('resize', update);
          onMenu(null);
        },
      };
    },
  });
}
