"use client";

import { useEffect } from "react";

export default function ScrollToTopOnError({ active }: { active: boolean }) {
  useEffect(() => {
    if (active) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [active]);
  return null;
}
