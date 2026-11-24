"use client";

import { useEffect, useRef, useState } from "react";

export default function SuggestionInput({
  name,
  defaultValue = "",
  required,
  placeholder,
  className,
  suggestions = [],
  visibleCount = 3,
  listId,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  suggestions?: string[];
  visibleCount?: number;
  listId?: string;
}) {
  const [value, setValue] = useState(defaultValue || "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uniq = Array.from(new Set((suggestions || []).map((s) => String(s || "").trim()).filter(Boolean)));
  const front = uniq.slice(0, visibleCount);
  const more = uniq.slice(visibleCount);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="space-y-1.5">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {uniq.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {front.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="px-2 py-1 rounded-md text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 max-w-full truncate"
              title={s}
            >
              {s}
            </button>
          ))}
          {more.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="px-2 py-1 rounded-md text-[11px] bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
              >
                More ▾
              </button>
              {open && (
                <div className="absolute z-20 mt-1 w-56 max-w-[calc(100vw-3rem)] max-h-52 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-1">
                  {more.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setValue(s);
                        setOpen(false);
                      }}
                      className="block w-full text-left px-2 py-1.5 rounded text-xs hover:bg-emerald-50 text-gray-800 break-words"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
