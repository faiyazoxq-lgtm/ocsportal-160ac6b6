import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { GlobalSearchDialog } from "./GlobalSearchDialog";

export function GlobalSearchButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        aria-label="Search"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden rounded border border-border bg-muted px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}