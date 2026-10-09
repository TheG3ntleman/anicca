import { Plugin } from 'prosemirror-state';
import { unwrapBox } from '../commands';

export function boxDeletion() {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        return event.key === 'Backspace' && !event.isComposing
          ? unwrapBox(view.state, view.dispatch) : false;
      },
      handleDOMEvents: {
        beforeinput(view, event) {
          const input = event as InputEvent;
          if (input.inputType !== 'deleteContentBackward' || input.isComposing) return false;
          if (!unwrapBox(view.state, view.dispatch)) return false;
          event.preventDefault();
          return true;
        },
      },
    },
  });
}
