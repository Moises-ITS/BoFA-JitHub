import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Analytics } from "@vercel/analytics/react"
import "./pages/home/styles/index.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
)
