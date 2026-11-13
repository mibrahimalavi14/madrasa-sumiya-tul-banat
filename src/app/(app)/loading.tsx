export default function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3 text-emerald-800">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin" />
        <div className="text-sm font-medium">Loading...</div>
      </div>
    </div>
  );
}
