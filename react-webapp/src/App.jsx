import { GraphPage } from "./features/graph/GraphPage";

export default function App() {
  const userId = import.meta.env.VITE_GRAPH_USER_ID || "test-user";
  const sessionToken = import.meta.env.VITE_GRAPH_BEARER_TOKEN || null;

  return <GraphPage userId={userId} sessionToken={sessionToken} />;
}
