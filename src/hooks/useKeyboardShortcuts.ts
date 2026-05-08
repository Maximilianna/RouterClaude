import { useEffect } from "react";
import type { ShortcutConfig } from "./useShortcutConfig";

interface ShortcutCallbacks {
  onSwitchTab1: () => void;
  onSwitchTab2: () => void;
  onAdd: () => void;
  onOpenSettings: () => void;
  onEscape: () => void;
}

interface ShortcutContext {
  showSettings: boolean;
  creating: boolean;
  editing: boolean;
  showAboutDialog: boolean;
  settingsSubPage: string | null;
}

function isInputElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

export function useKeyboardShortcuts(
  callbacks: ShortcutCallbacks,
  ctx: ShortcutContext,
  config: ShortcutConfig,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;

      // Escape: always fires, regardless of input focus
      if (e.key === "Escape") {
        e.preventDefault();
        callbacks.onEscape();
        return;
      }

      // Modifier shortcuts: require Ctrl/Meta
      if (!e.ctrlKey && !e.metaKey) return;
      // Skip if focus is in an input field (without Ctrl held)
      if (isInputElement(document.activeElement)) return;

      switch (e.key) {
        case config.switchTab1:
          if (!ctx.showSettings && !ctx.creating && !ctx.editing) {
            e.preventDefault();
            callbacks.onSwitchTab1();
          }
          break;
        case config.switchTab2:
          if (!ctx.showSettings && !ctx.creating && !ctx.editing) {
            e.preventDefault();
            callbacks.onSwitchTab2();
          }
          break;
        case config.add:
          if (!ctx.showSettings && !ctx.creating && !ctx.editing) {
            e.preventDefault();
            callbacks.onAdd();
          }
          break;
        case config.openSettings:
          if (!ctx.showSettings) {
            e.preventDefault();
            callbacks.onOpenSettings();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callbacks, ctx, config]);
}
