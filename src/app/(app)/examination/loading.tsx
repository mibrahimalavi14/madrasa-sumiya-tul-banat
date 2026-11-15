export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-44 rounded-lg bg-emerald-100" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
    </div>
  );
}
