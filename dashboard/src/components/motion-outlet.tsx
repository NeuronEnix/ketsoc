import { Suspense } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

/** Shown while a lazily-loaded screen chunk is fetched. */
export function ScreenFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_16px_var(--color-primary)]" />
    </div>
  );
}

/**
 * Wraps the routed screen in a quick fade/slide entrance, re-triggered on
 * navigation. Honors `prefers-reduced-motion` (no offset, instant). Uses
 * LazyMotion + `m` with the `domAnimation` feature set to keep the bundle lean.
 */
export function MotionOutlet() {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={location.pathname}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduce ? 0.12 : 0.18, ease: "easeOut" }}
        >
          <Suspense fallback={<ScreenFallback />}>
            <Outlet />
          </Suspense>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
