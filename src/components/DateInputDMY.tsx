"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function dmyFromDate(d: Date) {
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function parseToDate(value?: string | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]) - 1, year = Number(dmy[3]);
    const d = new Date(year, month, day);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]), month = Number(ymd[2]) - 1, day = Number(ymd[3]);
    const d = new Date(year, month, day);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function clampDay(year: number, month: number, day: number) {
  return Math.min(day, daysInMonth(year, month));
}

function ScrollColumn<T extends string | number>({
  label,
  items,
  value,
  onChange,
  format,
}: {
  label: string;
  items: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = itemRefs.current.get(String(value));
    if (el && ref.current) {
      const top = el.offsetTop - ref.current.clientHeight / 2 + el.clientHeight / 2;
      ref.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [value]);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold mb-1.5 text-center">{label}</div>
      <div ref={ref} className="h-56 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 px-1 py-1 scroll-smooth">
        {items.map((item) => {
          const active = item === value;
          const text = format ? format(item) : String(item);
          return (
            <button
              key={String(item)}
              type="button"
              ref={(node) => { if (node) itemRefs.current.set(String(item), node); else itemRefs.current.delete(String(item)); }}
              onClick={() => onChange(item)}
              className={`w-full px-2 py-2 my-0.5 rounded-lg text-sm transition-colors ${active ? "bg-emerald-600 text-white shadow-sm font-semibold" : "text-gray-700 hover:bg-white"}`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateInputDMY({
  name,
  defaultValue,
  required,
  placeholder = "DD/MM/YYYY",
  className = "",
  form,
  inputClassName = "",
  disabled,
}: {
  name: string;
  defaultValue?: string | Date | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
  form?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const initialDate = useMemo(() => parseToDate(typeof defaultValue === "string" ? defaultValue : defaultValue ? defaultValue.toISOString() : ""), [defaultValue]);
  const [text, setText] = useState(initialDate ? dmyFromDate(initialDate) : (typeof defaultValue === "string" && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(defaultValue.trim()) ? defaultValue.trim().replace(/-/g, "/") : ""));
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(initialDate?.getFullYear() ?? now.getFullYear());
  const [month, setMonth] = useState(initialDate ? initialDate.getMonth() : now.getMonth());
  const [day, setDay] = useState(initialDate?.getDate() ?? now.getDate());
  const rootRef = useRef<HTMLDivElement | null>(null);

  const years = useMemo(() => {
    const current = now.getFullYear();
    const start = 1950;
    const end = Math.max(current + 10, 2050);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [now]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1), [year, month]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openPicker = () => {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    const current = parseToDate(text);
    const y = current?.getFullYear() ?? now.getFullYear();
    const m = current ? current.getMonth() : now.getMonth();
    const d = current?.getDate() ?? now.getDate();
    setYear(y);
    setMonth(m);
    setDay(clampDay(y, m, d));
    setOpen(true);
  };

  const applyDate = (y: number, m: number, d: number) => {
    const dd = clampDay(y, m, d);
    setYear(y); setMonth(m); setDay(dd);
    setText(dmyFromDate(new Date(y, m, dd)));
  };

  const setToday = () => {
    const d = new Date();
    applyDate(d.getFullYear(), d.getMonth(), d.getDate());
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <input
        type="text"
        name={name}
        form={form}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        required={required}
        disabled={disabled}
        className={`w-full pr-10 ${inputClassName}`}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Open calendar"
        tabIndex={-1}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 z-30 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] bg-white border border-emerald-100 rounded-2xl shadow-xl p-3 select-none">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">Date Picker</div>
              <div className="text-sm font-semibold text-gray-900">Year → Month → Date</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 grid place-items-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">✕</button>
          </div>

          <div className="flex gap-2">
            <ScrollColumn label="Year" items={years} value={year} onChange={(y) => applyDate(y, month, day)} />
            <ScrollColumn label="Month" items={months} value={month} onChange={(m) => applyDate(year, m, day)} format={(m) => MONTHS[m].slice(0, 3)} />
            <ScrollColumn label="Date" items={days} value={Math.min(day, daysInMonth(year, month))} onChange={(d) => applyDate(year, month, d)} format={(d) => pad2(d)} />
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => { setText(""); setOpen(false); }} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-50">Clear</button>
            <div className="text-xs text-gray-500">{pad2(Math.min(day, daysInMonth(year, month)))}/{pad2(month + 1)}/{year}</div>
            <button type="button" onClick={setToday} className="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-md hover:bg-emerald-50">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}