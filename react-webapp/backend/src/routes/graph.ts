import { Router, Request, Response } from "express"
import { getNodes, getLinks, getShortestPath } from "../services/graphService"
import { requireSafeId } from "../middlewear/security"
import { requireAuth } from "../middlewear/auth"

const router = Router()
router.use(requireAuth)

router.get("/nodes", async (_req: Request, res: Response) => {
  try {
    const nodes = await getNodes()
    res.json(nodes)
  } catch (err) {
    console.error("Error fetching nodes:", err)
    res.status(500).json({ error: "Failed to fetch nodes" })
  }
})

router.get("/links", async (_req: Request, res: Response) => {
  try {
    const links = await getLinks()
    res.json(links)
  } catch (err) {
    console.error("Error fetching links:", err)
    res.status(500).json({ error: "Failed to fetch links" })
  }
})

router.get("/path", async (req: Request, res: Response) => {
  const { from, to } = req.query
  if (!from || !to || typeof from !== "string" || typeof to !== "string") {
    return res.status(400).json({ error: "from and to query params are required" })
  }
  const safeFrom = requireSafeId(from)
  const safeTo = requireSafeId(to)
  if (!safeFrom || !safeTo) {
    return res.status(400).json({ error: "Invalid from/to id format" })
  }
  try {
    const result = await getShortestPath(safeFrom, safeTo)
    res.json(result)
  } catch (err) {
    console.error("Error finding path:", err)
    res.status(500).json({ error: "Failed to find path" })
  }
})

export default router
