"use client";

import React, { useState, useEffect, useCallback } from "react";

import classNames from "@calcom/ui/classNames";

const STORAGE_KEY = "calcom_first_login_tooltips";

interface TooltipData {
  shown: number;
  dismissed: boolean;
}

interface TooltipState {
  [key: string]: TooltipData;
}

interface OnboardingTooltipProps {
  id: string;
  title: string;
  content: string;
  targetRef?: React.RefObject<HTMLElement>;
  position?: "top" | "bottom" | "left" | "right";
  showOnFirstLogin?: boolean;
  onDismiss?: () => void;
  className?: string;
}

function getTooltipState(): TooltipState {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveTooltipState(state: TooltipState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function OnboardingTooltip({
  id,
  title,
  content,
  position = "bottom",
  showOnFirstLogin = true,
  onDismiss,
  className,
}: OnboardingTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    const state = getTooltipState();
    const tooltipData = state[id] || { shown: 0, dismissed: false };

    if (showOnFirstLogin && !tooltipData.dismissed) {
      // Increment shown count
      tooltipData.shown += 1;
      state[id] = tooltipData;
      saveTooltipState(state);
      setViewCount(tooltipData.shown);

      // Show tooltip after a small delay for smooth appearance
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [id, showOnFirstLogin]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    const state = getTooltipState();
    state[id] = { ...(state[id] || { shown: 0 }), dismissed: true };
    saveTooltipState(state);
    onDismiss?.();
  }, [id, onDismiss]);

  if (!isVisible) return null;

  const arrowPositionClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
  };

  const arrowClasses = {
    top: "bottom-[-8px] left-5 border-l-transparent border-r-transparent border-b-transparent border-t-[#1e293b]",
    bottom:
      "top-[-8px] left-5 border-l-transparent border-r-transparent border-t-transparent border-b-[#1e293b]",
    left: "right-[-8px] top-3 border-t-transparent border-b-transparent border-r-transparent border-l-[#1e293b]",
    right:
      "left-[-8px] top-3 border-t-transparent border-b-transparent border-l-transparent border-r-[#1e293b]",
  };

  return (
    <div
      className={classNames("animate-fade-in absolute z-[10000]", arrowPositionClasses[position], className)}
      role="tooltip"
      aria-live="polite">
      {/* Info Badge */}
      <div className="absolute -left-3 -top-3 z-[10001] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-sm font-semibold text-white shadow-lg">
        i
      </div>

      {/* Tooltip Content */}
      <div className="relative max-w-[250px] rounded-lg bg-[#1e293b] p-4 text-white shadow-xl">
        {/* Arrow */}
        <div className={classNames("absolute h-0 w-0 border-8 border-solid", arrowClasses[position])} />

        {/* Header with title and close button */}
        <div className="mb-2 flex items-start justify-between">
          <h4 className="text-[15px] font-semibold text-white">{title}</h4>
          <button
            onClick={handleDismiss}
            className="ml-2 text-lg leading-none text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Close tooltip">
            &times;
          </button>
        </div>

        {/* Content */}
        <p className="mb-3 text-[13px] leading-relaxed text-white">{content}</p>

        {/* View count */}
        <div className="text-center text-[11px] text-slate-400">View count: {viewCount}</div>
      </div>
    </div>
  );
}

// Hook to check if it's user's first login
export function useIsFirstLogin(): boolean {
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const state = getTooltipState();
    // If no tooltips have been shown yet, it's the first login
    const hasSeenTooltips = Object.values(state).some((t) => t.shown > 0);
    setIsFirstLogin(!hasSeenTooltips);
  }, []);

  return isFirstLogin;
}

// Hook to manually show/reset tooltips
export function useOnboardingTooltips() {
  const resetAllTooltips = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const dismissTooltip = useCallback((id: string) => {
    const state = getTooltipState();
    state[id] = { ...(state[id] || { shown: 0 }), dismissed: true };
    saveTooltipState(state);
  }, []);

  const isTooltipDismissed = useCallback((id: string): boolean => {
    const state = getTooltipState();
    return state[id]?.dismissed ?? false;
  }, []);

  return { resetAllTooltips, dismissTooltip, isTooltipDismissed };
}

export default OnboardingTooltip;
