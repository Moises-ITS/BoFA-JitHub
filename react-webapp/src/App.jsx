import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { GraphPage } from "./features/graph/GraphPage";
import { fetchCurrentProfile } from "./api/graph";

export default function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [sessionToken, setSessionToken] = useState(null);
  const [graphUserId, setGraphUserId] = useState(null);
  const [bootstrapError, setBootstrapError] = useState(null);

  useEffect(() => {
    if (!apiBaseUrl) {
      setBootstrapError("Missing VITE_API_BASE_URL (or VITE_API_URL).");
      return;
    }

    if (!isLoaded || !isSignedIn) {
      setSessionToken(null);
      setGraphUserId(null);
      setBootstrapError(null);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const token = await getToken({ skipCache: true });
        if (!token) throw new Error("Could not obtain Clerk session token.");
        const profile = await fetchCurrentProfile(token);
        if (!profile?.id) {
          throw new Error("Authenticated profile is missing an id.");
        }
        if (!cancelled) {
          setSessionToken(token);
          setGraphUserId(profile.id);
          setBootstrapError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setSessionToken(null);
          setGraphUserId(null);
          setBootstrapError(message);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, isLoaded, isSignedIn, getToken]);

  if (!isLoaded) return <div style={{ padding: 24 }}>Loading authentication…</div>;
  if (!isSignedIn) return <div style={{ padding: 24 }}>Please sign in to view your graph.</div>;
  if (bootstrapError) return <div style={{ padding: 24 }}>Error: {bootstrapError}</div>;
  if (!sessionToken || !graphUserId) return <div style={{ padding: 24 }}>Loading profile…</div>;

  return <GraphPage userId={graphUserId} sessionToken={sessionToken} />;
}
