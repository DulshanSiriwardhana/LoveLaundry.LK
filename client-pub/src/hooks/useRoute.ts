import { useEffect, useState } from "react";

// Hash routing keeps deep links working when the site is served as static files.
// The canonical paths live in constants/actions.ts (e.g. /about becomes #/about).
function readPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith("/")) return "/";
  return hash.split("?")[0] || "/";
}

export function useRoute(): string {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return path;
}

export function navigateTo(path: string): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  if (readPath() === target) return;
  window.location.hash = target;
}
