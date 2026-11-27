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
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function sameDay(a: Date | null, y: number, m: number, d: number) {
  return !!a && a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;
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
  const [view, setView] = useState<"year" | "month" | "day">("year");
  const now = new Date();
  const baseYear = initialDate?.getFullYear() ?? now.getFullYear();
  const [yearWindowStart, setYearWindowStart] = useState(() => Math.floor(baseYear / 12) * 12);
  const [pickedYear, setPickedYear] = useState<number | null>(initialDate?.getFullYear() ?? null);
  const [pickedMonth, setPickedMonth] = useState<number | null>(initialDate ? initialDate.getMonth() : null);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    setPickedYear(current?.getFullYear() ?? null);
    setPickedMonth(current ? current.getMonth() : null);
    setYearWindowStart(Math.floor(y / 12) * 12);
    setView("year");
    setOpen(true);
  };

  const selectDay = (day: number) => {
    if (pickedYear == null || pickedMonth == null) return;
    const d = new Date(pickedYear, pickedMonth, day);
    setText(dmyFromDate(d));
    setOpen(false);
  };

  const setToday = () => {
    const d = new Date();
    setText(dmyFromDate(d));
    setOpen(false);
  };

  const years = Array.from({ length: 12 }, (_, i) => yearWindowStart + i);
  const days = pickedYear != null && pickedMonth != null ? daysInMonth(pickedYear, pickedMonth) : 31;
  const firstWeekday = pickedYear != null && pickedMonth != null ? new Date(pickedYear, pickedMonth, 1).getDay() : 0;
  const selected = parseToDate(text);
  const shiftMonth = (delta: number) => {
    if (pickedYear == null || pickedMonth == null) return;
    const d = new Date(pickedYear, pickedMonth + delta, 1);
    setPickedYear(d.getFullYear());
    setPickedMonth(d.getMonth());
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
        <div className="absolute left-1/2 -translate-x-1/2 z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] bg-white border border-emerald-100 rounded-2xl shadow-xl p-3 select-none">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">
                {view === "year" ? "Step 1 of 3" : view === "month" ? "Step 2 of 3" : "Step 3 of 3"}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {view === "year" ? "Select Year" : view === "month" ? "Select Month" : "Select Date"}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 grid place-items-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">✕</button>
          </div>

          {view === "year" && (
            <>
              <div className="flex items-center justify-between mb-3 bg-gray-50 rounded-xl px-2 py-1.5">
                <button type="button" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white text-gray-600" onClick={() => setYearWindowStart((y) => y - 12)} aria-label="Previous years">‹</button>
                <div className="text-sm font-medium text-gray-700">{yearWindowStart} – {yearWindowStart + 11}</div>
                <button type="button" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white text-gray-600" onClick={() => setYearWindowStart((y) => y + 12)} aria-label="Next years">›</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {years.map((y) => {
                  const active = pickedYear === y;
                  const isNow = now.getFullYear() === y;
                  return (
                    <button key={y} type="button" onClick={() => { setPickedYear(y); setView("month"); }}
                      className={`py-2.5 text-sm rounded-xl border transition-colors ${active ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : isNow ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "month" && (
            <>
              <div className="flex items-center justify-between mb-3 bg-gray-50 rounded-xl px-2 py-1.5">
                <button type="button" className="h-8 px-2 grid place-items-center rounded-lg hover:bg-white text-gray-600 text-sm" onClick={() => setView("year")}>← Year</button>
                <div className="text-sm font-semibold text-gray-800">{pickedYear}</div>
                <div className="w-14" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((m, i) => {
                  const active = pickedMonth === i;
                  const isNow = now.getFullYear() === pickedYear && now.getMonth() === i;
                  return (
                    <button key={m} type="button" onClick={() => { setPickedMonth(i); setView("day"); }}
                      className={`py-2.5 text-sm rounded-xl border transition-colors ${active ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : isNow ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "day" && pickedYear != null && pickedMonth != null && (
            <>
              <div className="flex items-center justify-between mb-3 bg-gray-50 rounded-xl px-2 py-1.5">
                <button type="button" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white text-gray-600" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
                <button type="button" onClick={() => setView("month")} className="text-sm font-semibold text-gray-800 hover:text-emerald-700 px-2 py-1 rounded-md">
                  {MONTHS[pickedMonth]} {pickedYear}
                </button>
                <button type="button" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white text-gray-600" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((wd) => <div key={wd} className="text-[11px] text-center text-gray-400 py-1 font-medium">{wd}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} className="py-1.5" />)}
                {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                  const isSel = sameDay(selected, pickedYear, pickedMonth, day);
                  const isToday = sameDay(now, pickedYear, pickedMonth, day);
                  return (
                    <button key={day} type="button" onClick={() => selectDay(day)}
                      className={`h-9 w-full text-sm rounded-xl transition-colors ${isSel ? "bg-emerald-600 text-white shadow-sm" : isToday ? "border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "text-gray-700 hover:bg-gray-100"}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => { setText(""); setOpen(false); }} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-50">Clear</button>
            <button type="button" onClick={setToday} className="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-md hover:bg-emerald-50">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}