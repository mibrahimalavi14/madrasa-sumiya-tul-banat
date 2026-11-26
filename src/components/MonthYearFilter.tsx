"use client";

import { useMemo, useState } from "react";

type Props = {
  yearOptions: number[];
  monthOptionsByYear: Record<string, number[]>;
  defaultYear: number;
  defaultMonth: number;
  monthLabel: string;
  yearLabel: string;
  monthName?: string;
  yearName?: string;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
};

export default function MonthYearFilter({
  yearOptions,
  monthOptionsByYear,
  defaultYear,
  defaultMonth,
  monthLabel,
  yearLabel,
  monthName = "month",
  yearName = "year",
  className = "",
  selectClassName = "border rounded px-2 py-1 text-sm bg-white",
  labelClassName = "text-xs text-gray-500",
}: Props) {
  const [year, setYear] = useState(defaultYear);
  const months = useMemo(() => monthOptionsByYear[String(year)] || monthOptionsByYear[String(defaultYear)] || [], [monthOptionsByYear, year, defaultYear]);
  const [month, setMonth] = useState(months.includes(defaultMonth) ? defaultMonth : (months[0] ?? defaultMonth));

  function onYearChange(nextYear: number) {
    setYear(nextYear);
    const nextMonths = monthOptionsByYear[String(nextYear)] || [];
    if (!nextMonths.includes(month)) setMonth(nextMonths[0] ?? month);
  }

  return (
    <div className={className}>
      <label className={labelClassName}>{monthLabel}</label>
      <select name={monthName} value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClassName}>
        {months.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <label className={labelClassName}>{yearLabel}</label>
      <select name={yearName} value={year} onChange={(e) => onYearChange(Number(e.target.value))} className={selectClassName}>
        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
