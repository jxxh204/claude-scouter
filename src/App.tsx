import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UsageData, ViewMode } from "./types";
import MiniView from "./components/MiniView";
import CompactView from "./components/CompactView";
import FullView from "./components/FullView";

export default function App() {
  const [data, setData] = useState<UsageData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("compact");

  useEffect(() => {
    invoke<UsageData>("get_usage").then(setData);
    const unlisten = listen<UsageData>("usage-updated", (event) => setData(event.payload));
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleModeChange = useCallback(async (mode: ViewMode) => {
    await invoke("set_view_mode", { mode });
    setViewMode(mode);
  }, []);

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
