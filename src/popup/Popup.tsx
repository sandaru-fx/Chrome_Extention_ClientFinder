import { MapPinned, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { MESSAGE_TYPES, STORAGE_KEYS } from "../shared/constants";
import type { ClientFinderMessage } from "../shared/types";

async function getStoredFilterState(): Promise<boolean> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.filterEnabled);
  return Boolean(result[STORAGE_KEYS.filterEnabled]);
}

async function notifyMapsTabs(enabled: boolean): Promise<void> {
  const tabs = await chrome.tabs.query({
    url: "https://www.google.com/maps/*"
  });

  const message: ClientFinderMessage = {
    type: MESSAGE_TYPES.setFilterEnabled,
    enabled
  };

  await Promise.allSettled(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => chrome.tabs.sendMessage(tab.id as number, message))
  );
}

export default function Popup() {
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getStoredFilterState()
      .then(setEnabled)
      .finally(() => setIsReady(true));
  }, []);

  async function handleToggle() {
    const nextEnabled = !enabled;

    setEnabled(nextEnabled);
    await chrome.storage.sync.set({
      [STORAGE_KEYS.filterEnabled]: nextEnabled
    });
    await notifyMapsTabs(nextEnabled);
  }

  return (
    <main className="w-80 bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white">
            <MapPinned size={21} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-5">Client Finder</h1>
            <p className="text-xs text-zinc-500">Google Maps lead filter</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5">
              Filter website-less shops
            </p>
            <p className="mt-1 text-xs leading-4 text-zinc-500">
              Hide listings that already show a website.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle website-less shop filter"
            disabled={!isReady}
            onClick={handleToggle}
            className={[
              "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2",
              enabled ? "bg-emerald-600" : "bg-zinc-300",
              !isReady ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            ].join(" ")}
          >
            <span
              className={[
                "grid size-6 place-items-center rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-7" : "translate-x-1"
              ].join(" ")}
            >
              <Power
                size={13}
                aria-hidden="true"
                className={enabled ? "text-emerald-700" : "text-zinc-500"}
              />
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
