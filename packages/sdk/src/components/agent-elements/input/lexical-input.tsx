"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

import {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
  setMentionClickHandler,
  type MentionClickHandler,
} from "./mention-node";
import { cn } from "../utils/cn";

export type MentionItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Arbitrary data carried with the mention; available on click/serialization. */
  data?: Record<string, unknown>;
};

export type MentionTriggerConfig = {
  /** Single character that opens the menu (e.g. "@" or "/"). */
  trigger: string;
  /** Items shown in the menu. Filtering by query is automatic when `filterItems` is omitted. */
  items: MentionItem[];
  /** Optional custom filter; receives the query (without trigger) and returns matched items. */
  filterItems?: (query: string, items: MentionItem[]) => MentionItem[];
  /** Called when an item is selected from the menu. */
  onSelect?: (item: MentionItem) => void;
  /** Optional className applied to the menu container. */
  menuClassName?: string;
  /** Minimum query length to show the menu (default 0). */
  minLength?: number;
};

export type LexicalInputHandle = {
  focus: () => void;
  clear: () => void;
  getText: () => string;
  setText: (text: string) => void;
};

export type LexicalInputProps = {
  /** Associates the editor with a surrounding `<label htmlFor={…}>`. */
  inputId?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  contentClassName?: string;
  /** Plain-text representation of the editor content (mentions serialized as their id). */
  onChange?: (text: string) => void;
  /** Called when the user presses Enter (without Shift). */
  onSubmit?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  /** Mention triggers (e.g. `@`, `/`). */
  triggers?: MentionTriggerConfig[];
  /** Called when an inserted mention chip is clicked. */
  onMentionClick?: MentionClickHandler;
  /** Maximum height in px before scroll appears. Default 120. */
  maxHeight?: number;
};

class MentionMenuOption extends MenuOption {
  item: MentionItem;
  trigger: string;

  constructor(item: MentionItem, trigger: string) {
    super(`${trigger}:${item.id}`);
    this.item = item;
    this.trigger = trigger;
  }
}

function defaultFilter(query: string, items: MentionItem[]): MentionItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      (i.description?.toLowerCase().includes(q) ?? false),
  );
}

const MENTION_MENU_GAP = 6;

/** Radix Popover anchors to Lexical's caret span and handles flip/collision. */
function MentionMenuDropdown({
  anchorElementRef,
  className,
  children,
}: {
  anchorElementRef: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover open modal={false}>
      <PopoverAnchor
        virtualRef={
          anchorElementRef as RefObject<{ getBoundingClientRect: () => DOMRect }>
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={MENTION_MENU_GAP}
        className={cn("z-999999 w-auto p-0", className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * One typeahead plugin instance per configured trigger. Lexical's
 * `LexicalTypeaheadMenuPlugin` only supports a single triggerFn per instance,
 * so we mount one per trigger and they coordinate via Lexical itself (only one
 * can have an active match at a time).
 */
function MentionTriggerPlugin({ config }: { config: MentionTriggerConfig }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(config.trigger, {
    minLength: config.minLength ?? 0,
  });

  const filterFn = config.filterItems ?? defaultFilter;
  const options = useMemo(() => {
    // Typeahead is closed — skip filtering potentially large item lists.
    if (query === null) return [];
    const filtered = filterFn(query, config.items);
    return filtered
      .slice(0, 10)
      .map((item) => new MentionMenuOption(item, config.trigger));
  }, [query, config.items, config.trigger, filterFn]);

  const onSelectOption = useCallback(
    (
      selectedOption: MentionMenuOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const mentionNode = $createMentionNode(
          selectedOption.trigger,
          selectedOption.item.id,
          selectedOption.item.label,
          selectedOption.item.data,
        );
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        } else {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([mentionNode]);
          }
        }
        // Insert a trailing space so the user can keep typing immediately.
        mentionNode.selectNext();
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          sel.insertText(" ");
        }
      });
      config.onSelect?.(selectedOption.item);
      closeMenu();
    },
    [editor, config],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionMenuOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      anchorClassName="z-999999"
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (anchorElementRef.current == null || options.length === 0) {
          return null;
        }
        return (
          <MentionMenuDropdown
            anchorElementRef={anchorElementRef}
            className={cn(
              "min-w-[220px] max-h-[260px] overflow-y-auto",
              "rounded-md border-0 border-border bg-an-background shadow-long",
              "py-1",
              config.menuClassName,
            )}
          >
            <ul className="m-0 p-0 list-none">
              {options.map((option, index) => (
                <li
                  key={option.key}
                  ref={option.setRefElement}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    setHighlightedIndex(index);
                    selectOptionAndCleanUp(option);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setHighlightedIndex(index);
                    selectOptionAndCleanUp(option);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 mx-1 rounded-sm",
                    "text-xs cursor-pointer",
                    selectedIndex === index
                      ? "bg-an-background-secondary text-an-foreground"
                      : "text-an-foreground-muted hover:bg-an-background-secondary/60",
                  )}
                >
                  {option.item.icon && (
                    <span className="inline-flex shrink-0 w-4 h-4 items-center justify-center">
                      {option.item.icon}
                    </span>
                  )}
                  <span className="flex-1 truncate">{option.item.label}</span>
                  {option.item.description && (
                    <span className="text-[11px] text-an-foreground-muted/70 truncate">
                      {option.item.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </MentionMenuDropdown>
        );
      }}
    />
  );
}

/**
 * Registers Enter -> submit; Shift+Enter inserts a line break (default Lexical behavior).
 *
 * Registered at `COMMAND_PRIORITY_LOW` so it runs before PlainTextPlugin's
 * `EDITOR`-priority newline handler. The tricky part is cooperating with
 * `LexicalTypeaheadMenuPlugin`, which also handles Enter at `LOW` — but it
 * only registers its listener lazily when its menu opens, which happens AFTER
 * we've already registered. Same-priority listeners run in registration
 * order, so ours would run first and prematurely submit.
 *
 * To defer to the typeahead when its menu is open, we check Lexical's own
 * signal: `useMenuAnchorRef` sets `aria-controls="typeahead-menu"` on the
 * editor's root element while a typeahead menu is open, and removes it when
 * the menu closes.
 */
function SubmitOnEnterPlugin({ onSubmit }: { onSubmit?: () => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!onSubmit) return;
    return editor.registerCommand<KeyboardEvent>(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event !== null && event.shiftKey) return false;
        const root = editor.getRootElement();
        if (root?.getAttribute("aria-controls") === "typeahead-menu") {
          // A typeahead menu is open; let it handle Enter (item selection).
          return false;
        }
        event?.preventDefault();
        onSubmit();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSubmit]);
  return null;
}

/**
 * Ensures Backspace removes a mention chip when the caret sits immediately
 * after one. Lexical's default behavior for adjacent inline DecoratorNodes
 * does not always delete them in a single keystroke under PlainTextPlugin, so
 * we handle it explicitly: if the previous sibling (or previous node when at
 * the start of a TextNode) is a MentionNode, remove it.
 */
function MentionBackspacePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_BACKSPACE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const anchor = selection.anchor;
        const node = anchor.getNode();
        // Case 1: caret is at offset 0 of a TextNode immediately after a mention
        if (anchor.type === "text" && anchor.offset === 0) {
          const prev = node.getPreviousSibling();
          if (prev && $isMentionNode(prev)) {
            prev.remove();
            return true;
          }
        }
        // Case 2: caret is at end of a paragraph and last child is a mention
        if (anchor.type === "element" && $isElementNode(node)) {
          const target = node.getChildren()[anchor.offset - 1];
          if (target && $isMentionNode(target)) {
            target.remove();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}

function DisabledPlugin({ disabled }: { disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  return null;
}

function AutoFocusPlugin({ enabled }: { enabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (enabled) editor.focus();
  }, [editor, enabled]);
  return null;
}

/**
 * Bridges Lexical's editor instance to the parent via an imperative ref so the
 * parent (InputBar) can `clear()` after sending and `focus()` the input.
 */
function EditorRefPlugin({
  forwardRef: forwardedRef,
}: {
  forwardRef: React.Ref<LexicalInputHandle>;
}) {
  const [editor] = useLexicalComposerContext();
  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => editor.focus(),
      clear: () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      },
      getText: () => {
        let text = "";
        editor.getEditorState().read(() => {
          text = $getRoot().getTextContent();
        });
        return text;
      },
      setText: (text: string) => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          if (text) {
            paragraph.append($createTextNode(text));
          }
          root.append(paragraph);
        });
      },
    }),
    [editor],
  );
  return null;
}

function MentionClickPlugin({ handler }: { handler?: MentionClickHandler }) {
  useEffect(() => {
    if (!handler) return;
    setMentionClickHandler(handler);
    return () => setMentionClickHandler(null);
  }, [handler]);
  return null;
}

const initialConfig = {
  namespace: "dddx-input",
  nodes: [MentionNode],
  theme: {
    paragraph: "m-0 p-0",
  },
  onError: (error: Error) => {
    // eslint-disable-next-line no-console
    console.error("[dddx] Lexical error", error);
  },
};

export const LexicalInput = forwardRef<LexicalInputHandle, LexicalInputProps>(
  function LexicalInput(
    {
      inputId,
      placeholder,
      disabled,
      autoFocus,
      className,
      contentClassName,
      onChange,
      onSubmit,
      onKeyDown,
      onPaste,
      triggers = [],
      onMentionClick,
      maxHeight = 120,
    },
    ref,
  ) {
    const handleChange = useCallback(
      (editorState: ReturnType<LexicalEditor["getEditorState"]>) => {
        if (!onChange) return;
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          onChange(text);
        });
      },
      [onChange],
    );

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                id={inputId}
                onPaste={onPaste}
                onKeyDown={(e) => {
                  if (
                    (e.currentTarget as HTMLElement).getAttribute(
                      "aria-controls",
                    ) === "typeahead-menu"
                  ) {
                    return;
                  }
                  onKeyDown?.(e);
                }}
                aria-placeholder={placeholder ?? ""}
                placeholder={
                  <div className="pointer-events-none absolute top-0 left-0 text-[14px] leading-[1.6] text-an-input-placeholder-color select-none">
                    {placeholder}
                  </div>
                }
                className={cn(
                  "w-full bg-transparent border-0 outline-none",
                  "text-[14px] leading-[1.6] text-an-foreground",
                  "min-h-[22px] whitespace-pre-wrap wrap-break-word",
                  disabled && "opacity-50 cursor-not-allowed",
                  contentClassName,
                )}
                style={{
                  maxHeight,
                  overflowY: "auto",
                }}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <MentionBackspacePlugin />
          <DisabledPlugin disabled={disabled} />
          <AutoFocusPlugin enabled={autoFocus} />
          <EditorRefPlugin forwardRef={ref} />
          <MentionClickPlugin handler={onMentionClick} />
          {/*
            Mount trigger plugins BEFORE SubmitOnEnterPlugin so their typeahead
            Enter handler is registered first at COMMAND_PRIORITY_LOW. Lexical
            iterates same-priority listeners in registration order, so the
            menu's selection handler gets a chance to fire before our submit.
          */}
          {triggers.map((config) => (
            <MentionTriggerPlugin key={config.trigger} config={config} />
          ))}
          <SubmitOnEnterPlugin onSubmit={onSubmit} />
        </div>
      </LexicalComposer>
    );
  },
);
