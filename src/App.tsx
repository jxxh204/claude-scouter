import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UsageData, ViewMode } from "./types";
import MiniView from "./components/MiniView";
import FullView from "./components/FullView";
import Onboarding from "./components/Onboarding";

interface AppConfig {
  plan: string | null;
  customLimit: number | null;
  viewMode: string | null;
  onboardingDone: boolean | null;
}

const AUTO_MINI_DELAY = 30_000; // 30s inactivity → mini

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset inactivity timer
  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      // Auto-switch to mini after inactivity (only if in full mode)
      setViewMode(prev => {
        if (prev === "full") {
          invoke("set_view_mode", { mode: "mini" });
          return "mini";
        }
        return prev;
      });
    }, AUTO_MINI_DELAY);
  }, []);

  useEffect(() => {
    invoke<AppConfig>("get_config").then((cfg) => {
      setNeedsOnboarding(!cfg.onboardingDone);
    });

    invoke<UsageData>("get_usage").then(setData);

    const unlistenUsage = listen<UsageData>("usage-updated", (event) => setData(event.payload));
    const unlistenMode = listen<string>("view-mode-changed", (event) => {
      setViewMode(event.payload as ViewMode);
    });

    return () => {
      unlistenUsage.then(fn => fn());
      unlistenMode.then(fn => fn());
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  // Track mouse/keyboard activity in full mode for auto-mini
  useEffect(() => {
    if (viewMode !== "full") return;

    resetInactivity();

    const onActivity = () => resetInactivity();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [viewMode, resetInactivity]);

  const handleModeChange = useCallback(async (mode: ViewMode) => {
    await invoke("set_view_mode", { mode });
    setViewMode(mode);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setNeedsOnboarding(false);
    invoke<UsageData>("get_usage").then(setData);
  }, []);

  if (needsOnboarding === null) {
    return <div className="app loading"><div className="spinner" /></div>;
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!data) {
    return <div className="app loading"><div className="spinner" /><p>Scanning Claude usage...</p></div>;
  }

  switch (viewMode) {
    case "mini":
      return <MiniView data={data} onModeChange={handleModeChange} />;
    case "full":
    default:
      return <FullView data={data} onModeChange={handleModeChange} />;
  }
}
