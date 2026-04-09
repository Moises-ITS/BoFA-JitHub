import type { GraphResponse } from "../features/graph/types";

// Put this in Vite env or similar in production.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Fetch graph payload from Express.
export async function fetchGraph(userId: string, limit = 50): Promise<GraphResponse> {
    const url = new URL(`${API_BASE}/api/graph`);
    url.searchParams.set("userId", userId);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Failed to fetch graph: ${response.status}`);
    }

    return response.json();
}

// Example mutation that updates a user interest and automatically
// causes backend cache invalidation.
export async function addInterest(userId: string, interestName: string) {
    const response = await fetch(`${API_BASE}/api/user/${userId}/interests`, {
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