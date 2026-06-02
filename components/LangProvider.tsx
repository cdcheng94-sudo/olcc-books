"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, T, type Dict, type Lang } from "@/lib/i18n";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: Dict;
};

const LangContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "olcc.lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Hydrate from localStorage on first client render so the user's last
  // choice persists across reloads.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  function toggle() {
    setLang(lang === "zh" ? "en" : "zh");
  }

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, t: T[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}
