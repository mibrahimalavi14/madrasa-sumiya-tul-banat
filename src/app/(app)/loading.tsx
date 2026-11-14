export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-100" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
