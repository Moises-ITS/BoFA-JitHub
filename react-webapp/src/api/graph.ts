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

function requireToken(token: string | null | undefined): string {
    const trimmed = (token ?? "").trim();
    if (!trimmed) {
        throw new Error(
            "Missing auth token. Set VITE_GRAPH_BEARER_TOKEN (or pass a session token) to call protected graph endpoints."
        );
    }
    return trimmed;
}

function authHeaders(token: string): HeadersInit {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

function toNodeId(value: unknown): string {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "id" in value) {
        const id = (value as { id?: unknown }).id;
        return typeof id === "string" ? id : "";
    }
    return "";
}

type AuthProfile = {
    gpa?: number | null;
    major?: string | null;
    graduationYear?: number | null;
    bio?: string | null;
    clubs?: string[] | null;
    companies?: string[] | null;
    interests?: string[] | null;
    linkedinUrl?: string | null;
    skills?: string[] | null;
    looking_for?: string[] | null;
    year?: string | null;
};

// Fetch graph payload from Express.
export async function fetchGraph(userId: string, limit = 50, token?: string | null): Promise<GraphResponse> {
    const bearer = requireToken(token);
    const nodesUrl = new URL(resolveApiUrl("/api/graph/nodes"), window.location.origin);
    const linksUrl = new URL(resolveApiUrl("/api/graph/links"), window.location.origin);

    const [nodesRes, linksRes] = await Promise.all([
        fetch(nodesUrl.toString(), { headers: authHeaders(bearer) }),
        fetch(linksUrl.toString(), { headers: authHeaders(bearer) }),
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
export async function addInterest(userId: string, interestName: string, token?: string | null) {
    const bearer = requireToken(token);
    const meResponse = await fetch(resolveApiUrl("/api/auth/me"), {
        headers: authHeaders(bearer),
    });
    if (!meResponse.ok) {
        throw new Error(`Failed to fetch current profile: ${meResponse.status}`);
    }

    const me = (await meResponse.json()) as AuthProfile & { id?: string };
    if (me.id && me.id !== userId) {
        throw new Error("Authenticated user does not match the requested graph user.");
    }
    if (!me.major || !me.graduationYear) {
        throw new Error("Cannot add interest: profile is incomplete (major and graduationYear are required).");
    }

    const currentInterests = Array.isArray(me.interests) ? me.interests : [];
    const mergedInterests = Array.from(
        new Set(
            [...currentInterests, interestName]
                .map((x) => String(x).trim())
                .filter(Boolean)
        )
    );

    const response = await fetch(resolveApiUrl("/api/auth/profile"), {
        method: "PUT",
        headers: authHeaders(bearer),
        body: JSON.stringify({
            gpa: me.gpa ?? null,
            major: me.major,
            graduationYear: me.graduationYear,
            bio: me.bio ?? "",
            clubs: Array.isArray(me.clubs) ? me.clubs : [],
            companies: Array.isArray(me.companies) ? me.companies : [],
            interests: mergedInterests,
            linkedinUrl: me.linkedinUrl ?? "",
            skills: Array.isArray(me.skills) ? me.skills : [],
            looking_for: Array.isArray(me.looking_for) ? me.looking_for : [],
            year: me.year ?? "",
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to add interest: ${response.status}`);
    }

    return response.json();
}
