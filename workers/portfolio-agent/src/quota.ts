import type { D1Database } from "@cloudflare/workers-types";
import { AUTO_PAUSE_LIMIT, DAILY_TURN_LIMIT, NEURON_ESTIMATE_PER_TURN } from "./config.ts";

export type QuotaDecision =
  | { allowed: true; day: string; turns: number; estimatedNeurons: number }
  | { allowed: false; reason: "paused" | "daily-limit" | "configuration" };

export async function consumeDailyQuota(
  database: D1Database,
  sub: string,
  now = Date.now(),
): Promise<QuotaDecision> {
  const day = new Date(now).toISOString().slice(0, 10);
  await database
    .prepare(
      "UPDATE agent_control SET estimated_neurons = 0, paused = CASE WHEN pause_reason = 'daily-neuron-budget' THEN 0 ELSE paused END, pause_reason = CASE WHEN pause_reason = 'daily-neuron-budget' THEN NULL ELSE pause_reason END, utc_day = ?1, updated_at = ?2 WHERE id = 1 AND utc_day <> ?1",
    )
    .bind(day, now)
    .run();
  const control = await database
    .prepare(
      "UPDATE agent_control SET estimated_neurons = estimated_neurons + ?1, paused = CASE WHEN estimated_neurons + ?1 >= ?2 THEN 1 ELSE paused END, pause_reason = CASE WHEN estimated_neurons + ?1 >= ?2 THEN 'daily-neuron-budget' ELSE pause_reason END, updated_at = ?3 WHERE id = 1 AND paused = 0 AND estimated_neurons < ?2",
    )
    .bind(NEURON_ESTIMATE_PER_TURN, AUTO_PAUSE_LIMIT, now)
    .run();
  if (control.meta.changes !== 1) return { allowed: false, reason: "paused" };

  await database
    .prepare(
      "INSERT OR IGNORE INTO usage_windows (sub, utc_day, turns, estimated_neurons) VALUES (?1, ?2, 0, 0)",
    )
    .bind(sub, day)
    .run();
  const updated = await database
    .prepare(
      "UPDATE usage_windows SET turns = turns + 1, estimated_neurons = estimated_neurons + ?1 WHERE sub = ?2 AND utc_day = ?3 AND turns < ?4",
    )
    .bind(NEURON_ESTIMATE_PER_TURN, sub, day, DAILY_TURN_LIMIT)
    .run();

  if (updated.meta.changes !== 1) {
    await database
      .prepare(
        "UPDATE agent_control SET estimated_neurons = MAX(0, estimated_neurons - ?1), paused = CASE WHEN pause_reason = 'daily-neuron-budget' AND estimated_neurons - ?1 < ?2 THEN 0 ELSE paused END, pause_reason = CASE WHEN pause_reason = 'daily-neuron-budget' AND estimated_neurons - ?1 < ?2 THEN NULL ELSE pause_reason END, updated_at = ?3 WHERE id = 1",
      )
      .bind(NEURON_ESTIMATE_PER_TURN, AUTO_PAUSE_LIMIT, now)
      .run();
    return { allowed: false, reason: "daily-limit" };
  }

  const row = await database
    .prepare("SELECT turns, estimated_neurons FROM usage_windows WHERE sub = ?1 AND utc_day = ?2")
    .bind(sub, day)
    .first<{ turns: number; estimated_neurons: number }>();
  if (!row) return { allowed: false, reason: "configuration" };
  return {
    allowed: true,
    day,
    turns: row.turns,
    estimatedNeurons: row.estimated_neurons,
  };
}
