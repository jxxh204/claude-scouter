import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UsageData, ViewMode } from "./types";
import MiniView from "./components/MiniView";
import CompactView from "./components/CompactView";
import FullView from "./components/FullView";
import Onboarding from "./components/Onboarding";

interface AppConfig {
  plan: string | null;
  customLimit: number | null;
  viewMode: string | null;
  onboardingDone: boolean | null;
}

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Load config to check onboarding status
    invoke<AppConfig>("get_config").then((cfg) => {
      setNeedsOnboarding(!cfg.onboardingDone);
      if (cfg.viewMode) setViewMode(cfg.viewMode as ViewMode);
    });

    invoke<UsageData>("get_usage").then(setData);

    const unlistenUsage = listen<UsageData>("usage-updated", (event) => setData(event.payload));
    // Listen for tray menu view mode changes
    const unlistenMode = listen<string>("view-mode-changed", (event) => {
      setViewMode(event.payload as ViewMode);
    });

    return () => {
      unlistenUsage.then(fn => fn());
      unlistenMode.then(fn => fn());
    };
  }, []);

  const handleModeChange = useCallback(async (mode: ViewMode) => {
    await invoke("set_view_mode", { mode });
    setViewMode(mode);
  }, []);

  const handleOnboardingComplete = useCallback((_plan: string, _customLimit?: number) => {
    setNeedsOnboarding(false);
    // Refresh usage data with new plan
    invoke<UsageData>("get_usage").then(setData);
  }, []);

  // Still loading config
  if (needsOnboarding === null) {
    return (
      <div className="app loading">
        <div className="spinner" />
      </div>
    );
  }

  // Show onboarding
  if (needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Still loading usage data
  if (!data) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Scanning Claude usage...</p>
      </div>
    );
  }

  switch (viewMode) {
    case "mini":
      return <MiniView data={data} onModeChange={handleModeChange} />;
    case "full":
      return <FullView data={data} onModeChange={handleModeChange} />;
    case "compact":
    default:
      return <CompactView data={data} onModeChange={handleModeChange} />;
  }
}
