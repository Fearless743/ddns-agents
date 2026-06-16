import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(`http://localhost:4000${req.url}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.body,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Backend error' })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
