export async function register() {
  // Edge runtime or Node runtime setup if needed
}

export function onRequestError(err: Error, request: unknown, context: unknown) {
  // Use dynamic import for reportError so it doesn't break Edge runtime
  import("./lib/errors").then((mod) => {
    mod.reportError(err, `Next.js: ${(request as { url?: string })?.url || "unknown_url"}`);
  }).catch((e) => {
    console.error("Failed to load error reporter:", e);
  });
}
