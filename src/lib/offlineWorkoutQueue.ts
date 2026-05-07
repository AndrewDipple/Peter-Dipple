import type { SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "pt-offline-workout-queue-v1";

type SetLogPayload = {
  client_id: string;
  client_program_id: string;
  client_program_day_id: string;
  client_program_day_exercise_id: string;
  log_date: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  completed: boolean;
};

type ProgramStartPayload = {
  client_program_id: string;
  program_start_date: string;
  current_week: number;
};

type CompletionPayload = {
  client_id: string;
  client_program_id: string;
  client_program_day_id: string;
  completed_date: string;
  completed_at: string;
};

export type OfflineWorkoutQueueItem =
  | {
      id: string;
      type: "set_log_upsert";
      createdAt: string;
      payload: SetLogPayload;
    }
  | {
      id: string;
      type: "set_log_update";
      createdAt: string;
      payload: {
        id: string;
        updates: Pick<
          SetLogPayload,
          "actual_weight_kg" | "actual_reps" | "completed"
        >;
      };
    }
  | {
      id: string;
      type: "program_start";
      createdAt: string;
      payload: ProgramStartPayload;
    }
  | {
      id: string;
      type: "completion_upsert";
      createdAt: string;
      payload: CompletionPayload;
    }
  | {
      id: string;
      type: "completion_delete";
      createdAt: string;
      payload: {
        completion_id: string;
      };
    };

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function getOfflineWorkoutQueue(): OfflineWorkoutQueueItem[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineWorkoutQueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineWorkoutQueue(items: OfflineWorkoutQueueItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("pt-offline-workout-queue-changed"));
}

const setLogKey = (payload: SetLogPayload) =>
  [
    payload.client_id,
    payload.client_program_day_exercise_id,
    payload.log_date,
    payload.set_number,
  ].join(":");

const completionKey = (payload: CompletionPayload) =>
  [
    payload.client_id,
    payload.client_program_id,
    payload.client_program_day_id,
    payload.completed_date,
  ].join(":");

export function queueOfflineWorkoutItem(item: OfflineWorkoutQueueItem) {
  const queue = getOfflineWorkoutQueue();
  const filtered = queue.filter((existing) => {
    if (item.type === "set_log_upsert" && existing.type === "set_log_upsert") {
      return setLogKey(existing.payload) !== setLogKey(item.payload);
    }

    if (item.type === "set_log_update" && existing.type === "set_log_update") {
      return existing.payload.id !== item.payload.id;
    }

    if (
      item.type === "completion_upsert" &&
      existing.type === "completion_upsert"
    ) {
      return completionKey(existing.payload) !== completionKey(item.payload);
    }

    return existing.id !== item.id;
  });

  saveOfflineWorkoutQueue([...filtered, item]);
}

export function removeQueuedCompletion(payload: CompletionPayload) {
  saveOfflineWorkoutQueue(
    getOfflineWorkoutQueue().filter(
      (item) =>
        item.type !== "completion_upsert" ||
        completionKey(item.payload) !== completionKey(payload)
    )
  );
}

export function getOfflineWorkoutQueueCount() {
  return getOfflineWorkoutQueue().length;
}

export async function syncOfflineWorkoutQueue(supabase: SupabaseClient) {
  const queue = getOfflineWorkoutQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const remaining: OfflineWorkoutQueueItem[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      if (item.type === "program_start") {
        const { error } = await supabase
          .from("client_programs")
          .update({
            program_start_date: item.payload.program_start_date,
            current_week: item.payload.current_week,
          })
          .eq("id", item.payload.client_program_id);

        if (error) throw error;
      }

      if (item.type === "set_log_upsert") {
        const { error } = await supabase.from("client_program_set_logs").insert([
          item.payload,
        ]);

        if (error) throw error;
      }

      if (item.type === "set_log_update") {
        const { error } = await supabase
          .from("client_program_set_logs")
          .update(item.payload.updates)
          .eq("id", item.payload.id);

        if (error) throw error;
      }

      if (item.type === "completion_upsert") {
        const { error } = await supabase
          .from("client_workout_completions")
          .upsert(item.payload, {
            onConflict:
              "client_id,client_program_id,client_program_day_id,completed_date",
          });

        if (error) throw error;
      }

      if (item.type === "completion_delete") {
        const { error } = await supabase
          .from("client_workout_completions")
          .delete()
          .eq("id", item.payload.completion_id);

        if (error) throw error;
      }

      synced += 1;
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineWorkoutQueue(remaining);
  return { synced, remaining: remaining.length };
}

export const createOfflineId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
