export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="h-8 w-28 rounded-lg bg-emerald-100" />
        <div className="h-5 w-20 rounded bg-emerald-50" />
      </div>
      <div className="h-20 rounded-xl bg-white border border-emerald-100" />
      <div className="h-[28rem] rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
