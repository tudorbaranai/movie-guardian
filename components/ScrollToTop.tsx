"use client";

// Every time you land on a new page, start at the top of it.
//
// Two separate things fight us here, which is why this needs both halves:
//
// 1. The BROWSER remembers your scroll position and restores it on Back. On a
//    movie site that's disorienting — you press Back to find a different film
//    and get dropped in the middle of its cast list.
// 2. NEXT.JS keeps your scroll position on a normal link click too, as long as
//    any part of the new page is on screen. So clicking a poster from the
//    bottom of the homepage lands you halfway down the movie page.
//
// This component renders nothing — its whole job is behaviour.
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// `behavior: "instant"` matters: globals.css sets `scroll-behavior: smooth`, so
// a plain scrollTo would visibly ANIMATE its way up the page. We want to
// already be at the top, not travel there.
function jumpToTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

export default function ScrollToTop() {
  // Changes on every navigation, which is our cue to reset the scroll.
  const pathname = usePathname();

  useEffect(() => {
    jumpToTop();
  }, [pathname]);

  useEffect(() => {
    // "manual" = browser, don't restore my scroll position for me.
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";

    // "popstate" is the browser's name for "back or forward was pressed". The
    // effect above already covers most of those, but not a Back that stays on
    // the same path (like moving between two search results pages).
    function handlePopState() {
      jumpToTop();
      // Once more after the page has painted, in case the incoming page was
      // still rendering when the first call ran.
      requestAnimationFrame(jumpToTop);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
