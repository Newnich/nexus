"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";

/**
 * NavigationProgress
 *
 * Renders an nprogress loading bar at the top of the page during route transitions.
 * Uses Next.js App Router's usePathname/useSearchParams to detect navigation.
 *
 * The cleanup/effect pattern:
 *   - When component unmounts (navigation starts) → NProgress.start()
 *   - When component remounts (navigation completes) → NProgress.done()
 *
 * Place this component once in a root layout.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ showSpinner: false, minimum: 0.1, speed: 300 });
  }, []);

  useEffect(() => {
    // Navigation is complete — finish the bar
    NProgress.done();

    // Start the bar when the next navigation begins (component unmounts)
    return () => {
      NProgress.start();
    };
  }, [pathname, searchParams]);

  return null;
}
