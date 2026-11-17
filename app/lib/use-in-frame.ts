import { useEffect, useState } from "react";

/**
 * Whether the page is showing inside a frame (the Shopify admin's iframe).
 * Starts from the server's `Sec-Fetch-Dest` answer and confirms on the client,
 * for browsers that do not send that header. A cross-origin `window.top`
 * access that throws also means "framed".
 */
export function useInFrame(serverFramed: boolean): boolean {
  const [framed, setFramed] = useState(serverFramed);

  useEffect(() => {
    try {
      if (window.self !== window.top) setFramed(true);
    } catch {
      setFramed(true);
    }
  }, []);

  return framed;
}
