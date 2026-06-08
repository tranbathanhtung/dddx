"use client";

import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type SerializedMentionNode = Spread<
  {
    trigger: string;
    mentionId: string;
    label: string;
    data?: Record<string, unknown>;
  },
  SerializedLexicalNode
>;

export type MentionClickHandler = (mention: {
  trigger: string;
  id: string;
  label: string;
  data?: Record<string, unknown>;
}) => void;

let mentionClickHandler: MentionClickHandler | null = null;

/**
 * Set a global click handler invoked whenever a rendered mention chip is
 * clicked. The host component should set this on mount and reset on unmount.
 *
 * Using a module-level handler keeps `MentionNode.decorate()` free of React
 * context lookups, which Lexical decorate functions cannot use directly.
 */
export function setMentionClickHandler(handler: MentionClickHandler | null) {
  mentionClickHandler = handler;
}

export class MentionNode extends DecoratorNode<ReactNode> {
  __trigger: string;
  __mentionId: string;
  __label: string;
  __data?: Record<string, unknown>;

  static override getType(): string {
    return "dddx-mention";
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__trigger,
      node.__mentionId,
      node.__label,
      node.__data,
      node.__key,
    );
  }

  constructor(
    trigger: string,
    mentionId: string,
    label: string,
    data?: Record<string, unknown>,
    key?: NodeKey,
  ) {
    super(key);
    this.__trigger = trigger;
    this.__mentionId = mentionId;
    this.__label = label;
    this.__data = data;
  }

  static override importJSON(serialized: SerializedMentionNode): MentionNode {
    return new MentionNode(
      serialized.trigger,
      serialized.mentionId,
      serialized.label,
      serialized.data,
    );
  }

  override exportJSON(): SerializedMentionNode {
    return {
      type: MentionNode.getType(),
      version: 1,
      trigger: this.__trigger,
      mentionId: this.__mentionId,
      label: this.__label,
      data: this.__data,
    };
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-dddx-mention", "true");
    element.setAttribute("data-mention-trigger", this.__trigger);
    element.setAttribute("data-mention-id", this.__mentionId);
    element.textContent = `${this.__trigger}${this.__label}`;
    return { element };
  }

  static override importDOM(): DOMConversionMap | null {
    return null;
  }

  /**
   * Plain-text serialization. Used when the editor exports its contents to a
   * plain string (e.g. for `onSend({ content })`). Returns the mention id
   * without trigger/label markup (e.g. `skill:make-a-deck` → `make-a-deck`).
   */
  override getTextContent(): string {
    const colon = this.__mentionId.indexOf(":");
    return colon >= 0 ? this.__mentionId.slice(colon + 1) : this.__mentionId;
  }

  override isInline(): true {
    return true;
  }

  override isKeyboardSelectable(): true {
    return true;
  }

  override isIsolated(): true {
    return true;
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  override updateDOM(): false {
    return false;
  }

  getMention() {
    return {
      trigger: this.__trigger,
      id: this.__mentionId,
      label: this.__label,
      data: this.__data,
    };
  }

  override decorate(): ReactNode {
    const mention = this.getMention();
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          mentionClickHandler?.(mention);
        }}
        className={cn(
          "text-an-primary-color text-sm font-medium cursor-pointer select-none",
        )}
        contentEditable={false}
        data-dddx-mention=""
      >
        {/* <span className="opacity-60">{this.__trigger}</span> */}
        <span>{this.__label}</span>
      </button>
    );
  }
}

export function $createMentionNode(
  trigger: string,
  id: string,
  label: string,
  data?: Record<string, unknown>,
): MentionNode {
  return new MentionNode(trigger, id, label, data);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
