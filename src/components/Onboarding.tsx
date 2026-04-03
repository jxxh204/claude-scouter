import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ViewMode } from "../types";
import "./Onboarding.css";

interface Props {
  onComplete: (plan: string, customLimit?: number) => void;
}

const PLANS = [
  { id: "pro", name: "Pro", limit: "44K tokens/5h", price: "$20/mo", icon: "⚡" },
  { id: "max5", name: "Max 5", limit: "220K tokens/5h", price: "$100/mo", icon: "🔥" },
  { id: "max20", name: "Max 20", limit: "880K tokens/5h", price: "$200/mo", icon: "💎" },
];

export default function Onboarding({ onComplete }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const handleSelect = (planId: string) => {
    setSelected(planId);
    setShowCustom(false);
  };

  const handleCustom = () => {
    setSelected(null);
    setShowCustom(true);
  };

  const handleConfirm = async () => {
    if (showCustom) {
      const limit = parseInt(customInput);
      if (isNaN(limit) || limit <= 0) return;
      await invoke("save_plan", { plan: "custom", customLimit: limit });
      onComplete("custom", limit);
    } else if (selected) {
      await invoke("save_plan", { plan: selected, customLimit: null });
      onComplete(selected);
    }
  };

  const canConfirm = selected || (showCustom && customInput && parseInt(customInput) > 0);

  return (
    <div className="onboarding">
      <div className="ob-content">
        <div className="ob-icon">👋</div>
        <h1 className="ob-title">Claude Scouter</h1>
        <p className="ob-subtitle">어떤 플랜을 사용하고 있나요?</p>

        <div className="ob-plans">
          {PLANS.map(p => (
            <div
              key={p.id}
              className={`ob-plan ${selected === p.id ? "selected" : ""}`}
              onClick={() => handleSelect(p.id)}
            >
              <span className="ob-plan-icon">{p.icon}</span>
              <div className="ob-plan-info">
                <span className="ob-plan-name">{p.name}</span>
                <span className="ob-plan-limit">{p.limit}</span>
              </div>
              <span className="ob-plan-price">{p.price}</span>
            </div>
          ))}

          <div
            className={`ob-plan ${showCustom ? "selected" : ""}`}
            onClick={handleCustom}
          >
            <span className="ob-plan-icon">⚙️</span>
            <div className="ob-plan-info">
              <span className="ob-plan-name">Custom</span>
              <span className="ob-plan-limit">직접 설정</span>
            </div>
          </div>
        </div>

        {showCustom && (
          <div className="ob-custom-row">
            <input
              type="number"
              placeholder="Token limit (예: 100000)"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              className="ob-custom-input"
              autoFocus
            />
          </div>
        )}

        <button
          className={`ob-confirm ${canConfirm ? "active" : ""}`}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          시작하기 →
        </button>

        <p className="ob-note">나중에 트레이 메뉴에서 변경할 수 있어요</p>
      </div>
    </div>
  );
}
