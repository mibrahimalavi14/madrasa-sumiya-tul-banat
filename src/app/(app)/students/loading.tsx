export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="h-8 w-40 rounded-lg bg-emerald-100" />
        <div className="h-10 w-36 rounded-lg bg-emerald-100" />
      </div>
      <div className="h-16 rounded-xl bg-white border border-emerald-100" />
      <div className="h-96 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
