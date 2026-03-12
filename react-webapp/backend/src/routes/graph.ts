import { Router, Request, Response } from "express"
import { getNodes, getLinks } from "../services/graphService"

const router = Router()

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

export default router
