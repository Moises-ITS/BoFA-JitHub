export type GraphNode = {
    id: string;
    type?: string;
    name?: string;
    label?: string;
    [key: string]: unknown;
};

export type GraphLink = {
    from: string;
    to: string;
    type: string;
};

export type GraphResponse = {
    user: GraphNode | null;
    nodes: GraphNode[];
    links: GraphLink[];
    generatedAt: string;
};