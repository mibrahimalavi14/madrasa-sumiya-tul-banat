"use client";

import { useEffect } from "react";

export default function ScrollToId({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);

  return null;
}
