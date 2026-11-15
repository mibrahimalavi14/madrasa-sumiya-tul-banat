export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-emerald-100" />
      <div className="h-16 rounded-xl bg-white border border-emerald-100" />
      <div className="h-80 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
