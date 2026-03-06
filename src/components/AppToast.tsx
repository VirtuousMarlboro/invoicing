"use client";

import React from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function AppToast({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border shadow-lg px-3 py-2 text-sm backdrop-blur-sm ${
            t.kind === "success"
              ? "bg-emerald-50/95 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200"
              : t.kind === "error"
                ? "bg-rose-50/95 border-rose-200 text-rose-800 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200"
                : "bg-blue-50/95 border-blue-200 text-blue-800 dark:bg-blue-950/90 dark:border-blue-800 dark:text-blue-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p>{t.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              x
            </button>
          </div>
          {t.actionLabel && t.onAction ? (
            <button
              type="button"
              onClick={() => {
                t.onAction?.();
                onDismiss(t.id);
              }}
              className="mt-2 text-xs font-semibold underline cursor-pointer"
            >
              {t.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
