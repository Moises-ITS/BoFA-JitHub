import { useCallback, useEffect, useState } from "react";
import { addInterest, fetchGraph } from "../../api/graph";
import type { GraphResponse } from "./types";

type UseGraphState = {
    data: GraphResponse | null;
    loading: boolean;
    error: string | null;
};

export function useGraph(userId: string, sessionToken: string | null, limit = 50) {
    const [state, setState] = useState<UseGraphState>({
        data: null,
        loading: true,
        error: null,
    });

    const load = useCallback(async () => {
        try {
            setState((prev) => ({
                ...prev,
                loading: true,
                error: null,
            }));

            const data = await fetchGraph(userId, limit, sessionToken);

            setState({
                data,
                loading: false,
                error: null,
            });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";

            setState({
                data: null,
                loading: false,
                error: message,
            });
        }
    }, [userId, limit, sessionToken]);

    const createInterest = useCallback(
        async (interestName: string) => {
            await addInterest(userId, interestName, sessionToken);

            // Reload after mutation so frontend gets fresh graph
            // after backend invalidates Redis cache.
            await load();
        },
        [userId, load, sessionToken]
    );

    useEffect(() => {
        void load();
    }, [load]);

    return {
        ...state,
        reload: load,
        createInterest,
    };
}
