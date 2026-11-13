export function gradeFromPercentage(p: number): { grade: string; status: "Pass" | "Fail"; labelUr: string } {
  const pct = Math.round(p * 100) / 100;
  if (pct >= 90) return { grade: "A+", status: "Pass", labelUr: "ممتاز" };
  if (pct >= 80) return { grade: "A", status: "Pass", labelUr: "بہترین" };
  if (pct >= 70) return { grade: "B", status: "Pass", labelUr: "اچھا" };
  if (pct >= 60) return { grade: "C", status: "Pass", labelUr: "تسلی بخش" };
  if (pct >= 40) return { grade: "D", status: "Pass", labelUr: "کامیاب" };
  return { grade: "F", status: "Fail", labelUr: "ناکام" };
}

export function isPass(p: number) {
  return p >= 40;
}

export function calculatePositions<T extends { id: string; percentage: number | null }>(items: T[]) {
  const eligible = items
    .filter((i) => (i.percentage ?? 0) >= 70)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  const posMap = new Map<string, number | null>();
  for (const i of items) posMap.set(i.id, null);
  let rank = 0;
  let lastPct: number | null = null;
  for (let idx = 0; idx < eligible.length; idx++) {
    const pct = eligible[idx].percentage ?? 0;
    if (lastPct === null || pct !== lastPct) {
      rank = idx + 1;
      lastPct = pct;
    }
    if (rank <= 3) posMap.set(eligible[idx].id, rank);
  }
  return posMap;
}
