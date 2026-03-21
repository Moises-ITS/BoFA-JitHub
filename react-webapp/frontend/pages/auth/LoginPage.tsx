import { useEffect } from "react"
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react"
import { useAuth } from "../../context/AuthContext"

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const { user, loading } = useAuth()

  // If already signed in with Clerk but no DB profile (stale session from a
  // failed setup attempt), sign out so the login form actually shows.
  useEffect(() => {
    if (isLoaded && isSignedIn && !loading && !user) {
      signOut()
    }
  }, [isLoaded, isSignedIn, loading, user, signOut])

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f1117",
    }}>
      <SignIn
        routing="path"
        path="/login"
        forceRedirectUrl="/home"
        signUpUrl="/signup"
        appearance={{
          variables: {
            colorPrimary: "#C0392B",
            colorBackground: "#111827",
            colorText: "#F0F0F0",
          },
        }}
      />
    </div>
  )
}
