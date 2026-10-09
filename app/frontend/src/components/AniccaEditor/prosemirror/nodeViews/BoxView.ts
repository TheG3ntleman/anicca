import type { Node as EditorNode } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';
import type { BoxRegistry } from '../../../../document/boxRegistry';
import styles from '../BoxView.module.css';

export class BoxView implements NodeView {
  dom = document.createElement('span');
  contentDOM = document.createElement('span');
  private title = document.createElement('span');
  private definitionKey: string;
  constructor(node: EditorNode, private registry: () => BoxRegistry) {
    this.definitionKey = `${node.attrs.definitionId}@${node.attrs.definitionVersion}`;
    this.dom.className = styles.box;
    this.title.className = styles.title;
    this.title.contentEditable = 'false';
    this.dom.append(this.title, this.contentDOM);
    this.update(node);
  }
  update(node: EditorNode) {
    if (node.type.name !== 'box' || `${node.attrs.definitionId}@${node.attrs.definitionVersion}` !== this.definitionKey) return false;
    const definition = this.registry().get(node.attrs.definitionId, node.attrs.definitionVersion);
    this.title.textContent = definition.label ?? '';
    this.title.hidden = definition.label === null;
    this.dom.dataset.id = node.attrs.id;
    return true;
  }
  selectNode() { this.dom.classList.add(styles.selected); }
  deselectNode() { this.dom.classList.remove(styles.selected); }
}
