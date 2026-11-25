"use client";

import { useMemo, useRef, useState } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function dmyFromDate(d: Date) {
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function isoFromDate(d: Date) {
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
  const [iso, setIso] = useState(initialDate ? isoFromDate(initialDate) : (typeof defaultValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(defaultValue.trim()) ? defaultValue.trim() : ""));
  const dateRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled) return;
    const el = dateRef.current;
    if (!el) return;
    // @ts-ignore
    if (typeof el.showPicker === "function") el.showPicker();
    else { el.focus(); el.click(); }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        name={name}
        form={form}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const d = parseToDate(v);
          setIso(d ? isoFromDate(d) : "");
        }}
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
        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Open calendar"
        tabIndex={-1}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
        </svg>
      </button>
      <input
        ref={dateRef}
        type="date"
        value={iso}
        onChange={(e) => {
          const v = e.target.value;
          setIso(v);
          const d = parseToDate(v);
          setText(d ? dmyFromDate(d) : "");
        }}
        className="sr-only absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
