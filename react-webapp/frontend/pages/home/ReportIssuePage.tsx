import { useMemo, useState } from "react";

const ISSUE_EMAIL = "mz397@njit.edu";

export default function ReportIssuePage() {
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");

  const canSend = issueTitle.trim().length > 0 || issueBody.trim().length > 0;

  const mailtoHref = useMemo(() => {
    const subjectPrefix = "[JitHub Issue Report]";
    const subject = issueTitle.trim()
      ? `${subjectPrefix} ${issueTitle.trim()}`
      : subjectPrefix;
    const body = issueBody.trim() || "No additional details provided.";
    return `mailto:${ISSUE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [issueTitle, issueBody]);

  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        border: "1px solid var(--border-default)",
        borderRadius: 20,
        background: "var(--bg-surface)",
        boxShadow: "var(--shadow-soft)",
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, color: "var(--text-default)", fontSize: "1.6rem", fontWeight: 700 }}>
        Report Issue
      </h1>

      <p style={{ marginTop: 10, marginBottom: 20, color: "var(--text-muted)", lineHeight: 1.6 }}>
        We are still refining the website and actively improving the experience. If you hit a bug,
        visual issue, or anything that feels off, please send it here so we can fix it quickly.
      </p>

      <label htmlFor="issue-title" style={{ display: "block", marginBottom: 8, color: "var(--text-default)", fontWeight: 600 }}>
        Issue Title
      </label>
      <input
        id="issue-title"
        type="text"
        value={issueTitle}
        onChange={(e) => setIssueTitle(e.target.value)}
        placeholder="Short title for the issue"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          background: "var(--bg-canvas)",
          color: "var(--text-default)",
          padding: "10px 12px",
          marginBottom: 16,
        }}
      />

      <label htmlFor="issue-body" style={{ display: "block", marginBottom: 8, color: "var(--text-default)", fontWeight: 600 }}>
        Issue Details
      </label>
      <textarea
        id="issue-body"
        value={issueBody}
        onChange={(e) => setIssueBody(e.target.value)}
        placeholder="Describe what happened, where it happened, and how to reproduce it."
        rows={8}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          background: "var(--bg-canvas)",
          color: "var(--text-default)",
          padding: "10px 12px",
          resize: "vertical",
          marginBottom: 16,
        }}
      />

      <a
        href={canSend ? mailtoHref : undefined}
        onClick={(e) => {
          if (!canSend) e.preventDefault();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 120,
          borderRadius: 12,
          padding: "10px 16px",
          background: canSend ? "var(--brand-primary)" : "rgba(148, 163, 184, 0.25)",
          color: canSend ? "#ffffff" : "var(--text-muted)",
          textDecoration: "none",
          fontWeight: 700,
          cursor: canSend ? "pointer" : "not-allowed",
        }}
      >
        Send
      </a>
    </section>
  );
}
