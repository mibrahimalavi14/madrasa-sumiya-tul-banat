"use client";

export default function DetailsCloseButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Close"
      className={className}
      onClick={(e) => {
        const details = (e.currentTarget as HTMLElement).closest("details");
        if (details) (details as HTMLDetailsElement).open = false;
      }}
    >
      ✕
    </button>
  );
}
