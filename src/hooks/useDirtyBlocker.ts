import { useBlocker } from "@tanstack/react-router";

/**
 * Block in-app navigation when a form has unsaved changes. Shows a
 * confirmation prompt; the user can choose to stay or discard.
 */
export function useDirtyBlocker(isDirty: boolean) {
  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) return false;
      return !window.confirm(
        "You have unsaved changes. Leave without saving?",
      );
    },
    enableBeforeUnload: isDirty,
  });
}