import type { ReactNode } from "react";
import React from "react";
import ReactDOM from "react-dom/client";

export function mountReactRoot(rootId: string, node: ReactNode): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`CSS Sentry UI root #${rootId} was not found.`);

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {node}
    </React.StrictMode>,
  );
}
