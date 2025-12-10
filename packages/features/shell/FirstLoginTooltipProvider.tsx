"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import classNames from "@calcom/ui/classNames";

const STORAGE_KEY = "calcom_first_login_tooltips";

interface TooltipData {
  shown: number;
  dismissed: boolean;
}

interface TooltipState {
  [key: string]: TooltipData;
}

interface TooltipConfig {
  id: string;
  title: string;
  content: string;
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

interface QuickLink {
  label: string;
  href: string;
}

function WelcomeTooltip({
  config,
  onDismiss,
  viewCount,
  quickLinks,
}: {
  config: TooltipConfig;
  onDismiss: () => void;
  viewCount: number;
  quickLinks: QuickLink[];
}) {
  return (
    <div
      className="animate-fade-in fixed left-1/2 top-24 z-[10000] -translate-x-1/2 transform"
      role="tooltip"
      aria-live="polite">
      {/* Info Badge */}
      <div className="absolute -left-3 -top-3 z-[10001] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-sm font-semibold text-white shadow-lg">
        i
      </div>

      {/* Tooltip Content */}
      <div className="relative max-w-[300px] rounded-lg bg-[#1e293b] p-4 text-white shadow-xl">
        {/* Arrow pointing up */}
        <div className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 transform border-8 border-solid border-b-[#1e293b] border-l-transparent border-r-transparent border-t-transparent" />

        {/* Header with title and close button */}
        <div className="mb-2 flex items-start justify-between">
          <h4 className="text-[15px] font-semibold text-white">{config.title}</h4>
          <button
            onClick={onDismiss}
            className="ml-2 text-lg leading-none text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Close tooltip">
            &times;
          </button>
        </div>

        {/* Content */}
        <p className="mb-3 text-[13px] leading-relaxed text-white">{config.content}</p>

        {/* Quick Links */}
        {quickLinks.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onDismiss}
                className="inline-flex items-center rounded-md bg-blue-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-600">
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* View count */}
        <div className="text-center text-[11px] text-slate-400">View count: {viewCount}</div>
      </div>
    </div>
  );
}

function HelpButton({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "fixed right-5 top-[70px] z-[9999] flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95",
        isActive ? "bg-blue-600" : "bg-blue-500"
      )}
      aria-label="Show help tooltips">
      ?
    </button>
  );
}

export function FirstLoginTooltipProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const tooltipConfig: TooltipConfig = {
    id: "welcome",
    title: t("welcome") || "Welcome!",
    content:
      t("first_login_welcome_message") ||
      "Welcome to your scheduling dashboard! Here you can create and manage your event types, view your bookings, and customize your availability.",
  };

  const quickLinks: QuickLink[] = [
    {
      label: t("calendar_sync") || "Calendar Sync",
      href: "/apps",
    },
    {
      label: t("working_hours") || "Working Hours",
      href: "/availability",
    },
  ];

  useEffect(() => {
    const state = getTooltipState();
    const tooltipData = state[tooltipConfig.id] || { shown: 0, dismissed: false };

    // Only show on first visit (not dismissed)
    if (!tooltipData.dismissed) {
      // Increment shown count
      tooltipData.shown += 1;
      state[tooltipConfig.id] = tooltipData;
      saveTooltipState(state);
      setViewCount(tooltipData.shown);

      // Show tooltip after a small delay
      const timer = setTimeout(() => {
        setShowWelcomeTooltip(true);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [tooltipConfig.id]);

  const handleDismiss = useCallback(() => {
    setShowWelcomeTooltip(false);
    const state = getTooltipState();
    state[tooltipConfig.id] = { ...(state[tooltipConfig.id] || { shown: 0 }), dismissed: true };
    saveTooltipState(state);
  }, [tooltipConfig.id]);

  const handleHelpClick = useCallback(() => {
    if (showWelcomeTooltip) {
      handleDismiss();
    } else {
      // Re-show tooltip
      const state = getTooltipState();
      const tooltipData = state[tooltipConfig.id] || { shown: 0, dismissed: false };
      tooltipData.shown += 1;
      state[tooltipConfig.id] = tooltipData;
      saveTooltipState(state);
      setViewCount(tooltipData.shown);
      setShowWelcomeTooltip(true);
    }
  }, [showWelcomeTooltip, handleDismiss, tooltipConfig.id]);

  return (
    <>
      {children}
      <HelpButton onClick={handleHelpClick} isActive={showWelcomeTooltip} />
      {showWelcomeTooltip && (
        <WelcomeTooltip
          config={tooltipConfig}
          onDismiss={handleDismiss}
          viewCount={viewCount}
          quickLinks={quickLinks}
        />
      )}
    </>
  );
}

export default FirstLoginTooltipProvider;
