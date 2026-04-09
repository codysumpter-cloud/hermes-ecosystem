import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const days = parseInt(req.query.days) || 30;

    // Build date keys for the last N days
    const keys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.push(`stars:history:${d.toISOString().slice(0, 10)}`);
    }

    // Fetch all snapshots from KV
    const snapshots = await Promise.all(
      keys.map(async (key) => {
        const data = await kv.get(key).catch(() => null);
        return { date: key.replace("stars:history:", ""), data };
      })
    );

    // Filter out missing days and reverse to chronological order
    const history = snapshots
      .filter(s => s.data !== null)
      .reverse();

    return res.status(200).json({
      days: history.length,
      history
    });
  } catch (err) {
    console.error("Stars history error:", err);
    return res.status(200).json({ days: 0, history: [], error: err.message });
  }
}
