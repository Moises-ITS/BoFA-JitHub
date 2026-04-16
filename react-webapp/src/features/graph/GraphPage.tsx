import React, { useState } from "react";
import { useGraph } from "./useGraph";

type Props = {
    userId: string;
};

export function GraphPage({ userId }: Props) {
    const { data, loading, error, reload, createInterest } = useGraph(userId, 50);
    const [interestName, setInterestName] = useState("");

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!interestName.trim()) return;

        await createInterest(interestName.trim());
        setInterestName("");
    };

    if (loading) {
        return <div>Loading graph…</div>;
    }

    if (error) {
        return (
            <div>
                <p>Error: {error}</p>
                <button onClick={() => void reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <h1>JitHub Graph</h1>

            <p>
                User: <strong>{data?.user?.id ?? "Unknown"}</strong>
            </p>

            <p>
                Nodes: <strong>{data?.nodes.length ?? 0}</strong> | Links:{" "}
                <strong>{data?.links.length ?? 0}</strong>
            </p>

            <form onSubmit={onSubmit} style={{ marginBottom: 16 }}>
                <input
                    value={interestName}
                    onChange={(e) => setInterestName(e.target.value)}
                    placeholder="Add interest"
                />
                <button type="submit" style={{ marginLeft: 8 }}>
                    Save
                </button>
            </form>

            <button onClick={() => void reload()} style={{ marginBottom: 16 }}>
                Refresh graph
            </button>

            <h2>Nodes</h2>
            <pre
                style={{
                    background: "#111",
                    color: "#eee",
                    padding: 16,
                    borderRadius: 12,
                    overflowX: "auto",
                }}
            >
                {JSON.stringify(data?.nodes, null, 2)}
            </pre>

            <h2>Links</h2>
            <pre
                style={{
                    background: "#111",
                    color: "#eee",
                    padding: 16,
                    borderRadius: 12,
                    overflowX: "auto",
                }}
            >
                {JSON.stringify(data?.links, null, 2)}
            </pre>
        </div>
    );
}