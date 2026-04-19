"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Load the canvas only in the browser after mount. That keeps React Flow out of the server
 * bundle execution path and avoids `next/dynamic` + Webpack chunk/HMR glitches that sometimes
 * show up as `__webpack_modules__[moduleId] is not a function`.
 */
export function BlueprintConfiguratorShell() {
  const [BlueprintConfigurator, setBlueprintConfigurator] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/blueprint-configurator/blueprint-configurator").then((mod) => {
      const C = mod.default;
      if (!cancelled && typeof C === "function") {
        setBlueprintConfigurator(() => C);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!BlueprintConfigurator) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas text-sm text-muted">
        Loading blueprint…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BlueprintConfigurator />
    </div>
  );
}
