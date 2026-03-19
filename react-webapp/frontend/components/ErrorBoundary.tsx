// ─────────────────────────────────────────────────────────────────────────────
// components/ErrorBoundary.tsx
// Catches runtime errors in the component tree and renders a fallback UI.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  private handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        height:         "100vh",
        gap:            "1rem",
        background:     "#0f1117",
        color:          "#e2e8f0",
        fontFamily:     "sans-serif",
      }}>
        <span style={{ fontSize: "2rem" }}>⚠️</span>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ color: "#718096", maxWidth: 420, textAlign: "center", margin: 0 }}>
          {this.state.error?.message ?? "An unexpected error occurred."}
        </p>
        <button
          onClick={this.handleReset}
          style={{
            padding:      "0.5rem 1.25rem",
            background:   "#FF6B35",
            color:        "white",
            border:       "none",
            borderRadius: "6px",
            cursor:       "pointer",
            fontWeight:   600,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }
}
