/**
 * utils/resolveCurrentUserNode.ts — answers "which node in the graph is YOU?".
 *
 * Matching is a deliberate fallback ladder, strongest signal first:
 *  1. strong ids — node.id equals users.id for every node created through the
 *     normal signup path (plus legacy id-ish detail fields for old nodes)
 *  2. exact email in details (legacy nodes only; the bulk graph payload no
 *     longer ships emails)
 *  3. exact name match on the label
 *  4. scored fuzzy match (name tokens + email local-part + major tiebreak)
 *     with a minimum-confidence threshold so we never guess wildly.
 * Returns null rather than a bad guess — features that highlight "your" node
 * must degrade gracefully for unmatchable accounts.
 */
import type { GraphNode } from "../types/graphNodes";

export const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const normalizeSearchName = (v: unknown) => normalize(v).replace(/[^a-z0-9]/g, "");

export const resolveCurrentUserNode = (
  nodes: GraphNode[],
  user: { id?: string; email?: string; name?: string; major?: string } | null
) => {
  if (!user) return null;
  const userId = normalize(user.id);
  const userEmail = normalize(user.email);
  const userEmailLocalPart = userEmail.includes("@") ? userEmail.split("@")[0] : "";
  const userName = normalize(user.name);
  const userMajor = normalize(user.major);

  const byStrongId = nodes.find((n) => {
    if (n.type !== "student") return false;
    const details = (n.details ?? {}) as Record<string, unknown>;
    const candidates = [
      n.id,
      details.id,
      details.user_id,
      details.userId,
      details.profile_id,
      details.profileId,
      details.graph_node_id,
      details.graphNodeId,
      details.clerk_id,
      details.clerkId,
      details.email,
    ];
    return candidates.some((c) => {
      const value = normalize(c);
      return value && (value === userId || value === userEmail || value === userEmailLocalPart);
    });
  });
  if (byStrongId) return byStrongId;

  const byEmail = nodes.find((n) => {
    if (n.type !== "student" || !userEmail) return false;
    const details = (n.details ?? {}) as Record<string, unknown>;
    return normalize(details.email) === userEmail;
  });
  if (byEmail) return byEmail;

  const byName = nodes.find((n) => n.type === "student" && userName && normalize(n.label) === userName);
  if (byName) return byName;

  const nameTokens = userName.split(/\s+/).filter(Boolean);
  const scored = nodes
    .filter((n) => n.type === "student")
    .map((n) => {
      const details = (n.details ?? {}) as Record<string, unknown>;
      const label = normalize(n.label);
      const detailName = normalize(details.name);
      const detailMajor = normalize(details.major);
      let score = 0;
      if (userEmailLocalPart && (label.includes(userEmailLocalPart) || detailName.includes(userEmailLocalPart))) score += 5;
      if (userName && (label.includes(userName) || detailName.includes(userName))) score += 6;
      if (nameTokens.length && nameTokens.some((t) => t.length > 2 && (label.includes(t) || detailName.includes(t)))) score += 3;
      if (userMajor && detailMajor && detailMajor === userMajor) score += 1;
      return { node: n, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length && scored[0].score >= 6) return scored[0].node;
  return null;
};
