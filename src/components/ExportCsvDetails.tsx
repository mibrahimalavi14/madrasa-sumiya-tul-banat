"use client";

import { useEffect, useRef } from "react";

export default function ExportCsvDetails({
  label,
  children,
  className = "",
  summaryClassName = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  summaryClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (!el || !el.open) return;
      if (e.target instanceof Node && !el.contains(e.target)) el.open = false;
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName}>{label}</summary>
      {children}
    </details>
  );
}
