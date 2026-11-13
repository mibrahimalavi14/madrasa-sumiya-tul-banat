"use client";
import { useRouter } from "next/navigation";

export default function LanguageToggle({ lang }: { lang: "en" | "ur" }) {
  const router = useRouter();
  function setLang(next: "en" | "ur") {
    document.cookie = `msb_lang=${next}; path=/; max-age=31536000`;
    router.refresh();
  }
  return (
    <div className="flex gap-1 bg-emerald-900/60 border border-emerald-700/60 rounded-lg p-1">
      <button type="button" onClick={() => setLang("en")} className={`px-2 py-1 rounded text-xs ${lang === "en" ? "bg-white/20 text-white" : "text-emerald-200 hover:bg-white/10"}`}>EN</button>
      <button type="button" onClick={() => setLang("ur")} className={`px-2 py-1 rounded text-xs font-urdu ${lang === "ur" ? "bg-white/20 text-white" : "text-emerald-200 hover:bg-white/10"}`}>اردو</button>
    </div>
  );
}
