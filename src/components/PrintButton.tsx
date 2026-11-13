"use client";

export default function PrintButton({ label = "Print / پرنٹ", className = "" }: { label?: string; className?: string }) {
  return (
    <button onClick={() => window.print()} className={className || "bg-emerald-800 text-white px-4 py-2 rounded"}>
      {label}
    </button>
  );
}
