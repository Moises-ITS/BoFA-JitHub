import type { GraphResponse } from "../features/graph/types";

const RAW_API_BASE =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "";

const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function resolveApiUrl(path: string): string {
    if (API_BASE) return `${API_BASE}${path}`;
    return path;
}

function toNodeId(value: unknown): string {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "id" in value) {
        const id = (value as { id?: unknown }).id;
        return typeof id === "string" ? id : "";
    }
    return "";
}

// Fetch graph payload from Express.
export async function fetchGraph(userId: string, limit = 50): Promise<GraphResponse> {
    const nodesUrl = new URL(resolveApiUrl("/api/graph/nodes"), window.location.origin);
    const linksUrl = new URL(resolveApiUrl("/api/graph/links"), window.location.origin);

    const [nodesRes, linksRes] = await Promise.all([
        fetch(nodesUrl.toString()),
        fetch(linksUrl.toString()),
    ]);

    if (!nodesRes.ok) {
        throw new Error(`Failed to fetch graph nodes: ${nodesRes.status}`);
    }
    if (!linksRes.ok) {
        throw new Error(`Failed to fetch graph links: ${linksRes.status}`);
    }

    const rawNodes = await nodesRes.json();
    const rawLinks = await linksRes.json();

    const nodes = Array.isArray(rawNodes) ? rawNodes.slice(0, Math.max(1, limit)) : [];
    const links = Array.isArray(rawLinks)
        ? rawLinks.map((link) => ({
            from: toNodeId((link as { from?: unknown; source?: unknown }).from ?? (link as { source?: unknown }).source),
            to: toNodeId((link as { to?: unknown; target?: unknown }).to ?? (link as { target?: unknown }).target),
            type: String((link as { type?: unknown; rel?: unknown }).type ?? (link as { rel?: unknown }).rel ?? "related_to"),
        }))
        : [];

    const user = nodes.find((node) => {
        const id = (node as { id?: unknown }).id;
        return typeof id === "string" && id === userId;
    }) ?? null;

    return {
        user,
        nodes,
        links,
        generatedAt: new Date().toISOString(),
    };
}

// Example mutation that updates a user interest and automatically
// causes backend cache invalidation.
export async function addInterest(userId: string, interestName: string) {
    const response = await fetch(resolveApiUrl(`/api/user/${userId}/interests`), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ interestName }),
    });

    if (!response.ok) {
        throw new Error(`Failed to add interest: ${response.status}`);
    }

    return response.json();
}
