"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

type Props = {
  /** The search currently applied (from the URL). */
  value: string;
  onSearch: (value: string) => void;
};

/** Search box that applies itself 300 ms after the last keystroke. */
export function SearchInput({ value, onSearch }: Props) {
  const [draft, setDraft] = useState(value);
  const [typing, setTyping] = useState(false);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL when it changes from elsewhere (back button, "Clear filters"),
  // but never overwrite what the user is typing right now.
  if (value !== seen) {
    setSeen(value);
    if (!typing) setDraft(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: string) => {
    setDraft(next);
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);
      if (next.trim() !== value) onSearch(next.trim());
    }, DEBOUNCE_MS);
  };

  const clear = () => {
    clearTimeout(timer.current);
    setTyping(false);
    setDraft("");
    if (value) onSearch("");
  };

  return (
    <div className="relative w-64 max-w-full">
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search by name or email"
        placeholder="Search name or email"
        autoComplete="off"
        value={draft}
        onChange={(event) => change(event.target.value)}
        className="px-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  );
}
