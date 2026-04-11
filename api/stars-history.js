import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const days = parseInt(req.query.days) || 30;
    const debug = req.query.debug === "1";

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
        let raw = null;
        let err = null;
        try {
          raw = await kv.get(key);
        } catch (e) {
          err = e.message;
        }
        return {
          date: key.replace("stars:history:", ""),
          key,
          data: raw,
          dataType: raw === null ? "null" : typeof raw,
          err,
        };
      })
    );

    // Debug mode: return everything we tried
    if (debug) {
      // Also try to list all stars:history:* keys via SCAN if available
      let allHistoryKeys = null;
      try {
        if (typeof kv.keys === "function") {
          allHistoryKeys = await kv.keys("stars:history:*");
        }
      } catch (e) {
        allHistoryKeys = `kv.keys error: ${e.message}`;
      }

      return res.status(200).json({
        triedKeys: keys,
        snapshots: snapshots.map(s => ({
          date: s.date,
          hasData: s.data !== null,
          dataType: s.dataType,
          err: s.err,
        })),
        allHistoryKeys,
      });
    }

    // Filter out missing days and reverse to chronological order
    const history = snapshots
      .filter(s => s.data !== null)
      .map(s => ({ date: s.date, data: s.data }))
      .reverse();

    return res.status(200).json({
      days: history.length,
      history,
    });
  } catch (err) {
    console.error("Stars history error:", err);
    return res.status(200).json({ days: 0, history: [], error: err.message });
  }
}
