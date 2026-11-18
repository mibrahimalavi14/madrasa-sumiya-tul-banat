"use client";

export default function SelectAllBulkCheckbox({ formId, name, title }: { formId: string; name: string; title?: string }) {
  return (
    <input
      type="checkbox"
      title={title || "Select all"}
      className="h-4 w-4 rounded border-emerald-300 text-emerald-700 cursor-pointer"
      onChange={(e) => {
        const checked = e.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][form="${CSS.escape(formId)}"][name="${CSS.escape(name)}"]`).forEach((cb) => {
          cb.checked = checked;
        });
      }}
    />
  );
}
