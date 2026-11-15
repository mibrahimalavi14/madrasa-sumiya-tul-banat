export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded-lg bg-emerald-100" />
      <div className="h-40 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
      <div className="h-64 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
