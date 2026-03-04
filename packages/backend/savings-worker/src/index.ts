// ============================================================================
// Savings Worker — One-way savings vault Cloudflare Worker
// ============================================================================
// Routes:
//   POST /deposit — Deposit profits (one-way, never returns)
//   GET  /state   — Get savings totals
// ============================================================================

export interface Env {
  TRADE_DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/deposit") {
        return await handleDeposit(request, env);
      }

      if (request.method === "GET" && url.pathname === "/state") {
        return await getState(env);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok", worker: "savings" });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Savings Worker error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Internal error" },
        { status: 500 }
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function handleDeposit(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    amount: number;
    executionId: string;
    depositId: string;
  };

  if (!body.amount || body.amount <= 0) {
    return Response.json({ error: "Invalid deposit amount" }, { status: 400 });
  }

  // Insert deposit record
  await env.TRADE_DB.prepare(
    "INSERT INTO savings (deposit_id, amount, execution_id) VALUES (?, ?, ?)"
  )
    .bind(body.depositId, body.amount, body.executionId)
    .run();

  // Update savings state (upsert)
  await env.TRADE_DB.prepare(`
    INSERT INTO savings_state (id, total_locked, deposit_count, last_deposit_at)
    VALUES (1, ?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      total_locked = total_locked + ?,
      deposit_count = deposit_count + 1,
      last_deposit_at = datetime('now')
  `)
    .bind(body.amount, body.amount)
    .run();

  // Audit log
  await env.TRADE_DB.prepare(
    "INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)"
  )
    .bind("savings:deposit", JSON.stringify(body))
    .run();

  return Response.json({ deposited: body.amount, depositId: body.depositId });
}

async function getState(env: Env): Promise<Response> {
  const state = await env.TRADE_DB.prepare(
    "SELECT * FROM savings_state WHERE id = 1"
  ).first();

  if (!state) {
    return Response.json({ totalLocked: 0, depositCount: 0 });
  }

  return Response.json(state);
}
