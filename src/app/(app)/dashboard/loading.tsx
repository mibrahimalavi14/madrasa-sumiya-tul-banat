export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 rounded-2xl bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-100" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="h-72 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
        <div className="h-72 rounded-2xl bg-white border border-emerald-100 shadow-sm" />
      </div>
    </div>
  );
}
