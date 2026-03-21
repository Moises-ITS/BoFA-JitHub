import { SignUp } from "@clerk/clerk-react"

export default function SignupPage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f1117",
    }}>
      <SignUp
        routing="path"
        path="/signup"
        forceRedirectUrl="/home"
        signInUrl="/login"
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
