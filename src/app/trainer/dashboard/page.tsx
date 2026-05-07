"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { styles } from "@/lib/design";
import { supabase } from "@/lib/supabase";
import { getMondayOf } from "@/lib/dates";
import { CalendarClock } from "lucide-react";

type Client = {
  id: string;
  full_name: string;
  email: string;
  calorie_target: number | null;
  daily_step_target: number;
  profile_id: string | null;
  last_sign_in_at: string | null;
};

type WorkoutSetLog = {
  id: string;
  client_id: string;
  client_program_day_id: string;
  client_program_day_exercise_id: string;
  completed: boolean;
  created_at: string;
};

type ProgramExercise = {
  id: string;
  client_program_day_id: string;
  sets: number | null;
};

type MealLogRow = {
  client_id: string;
  quantity: number | null;
  recipes: {
    calories: number | null;
  } | {
    calories: number | null;
  }[] | null;
};

type DailyTracking = {
  id: string;
  client_id: string;
  water_completed: boolean;
  steps_logged: number | null;
};

type UnreadClientMessage = {
  id: string;
  client_id: string;
  body: string;
  context_label: string | null;
  created_at: string;
  client_name: string;
};

type WeeklyCheckIn = {
  client_id: string;
  week_start: string;
};

type PtSessionRequest = {
  id: string;
  client_id: string;
  preferred_start_at: string;
  client_note: string | null;
  status: "requested" | "confirmed" | "alternative_suggested" | "cancelled" | "declined";
  trainer_response: string | null;
  proposed_start_at: string | null;
  confirmed_start_at: string | null;
  created_at: string;
  client_name: string;
};
type ClientStatusCard = {
  client: Client;
  workout: {
    status: "green" | "amber" | "red";
    label: string;
  };
  nutrition: {
    status: "green" | "amber" | "red";
    label: string;
  };
  steps: number | null;
  waterCompleted: boolean;
};

function getDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function shiftDate(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getDateString(date);
}

function getStatusClasses(status: "green" | "amber" | "red") {
  if (status === "green") return styles.statusGreen;
  if (status === "amber") return styles.statusAmber;
  return styles.statusRed;
}

export default function TrainerDashboardPage() {
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [clientCards, setClientCards] = useState<ClientStatusCard[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<UnreadClientMessage[]>([]);
  const [weeklyCheckIns, setWeeklyCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [ptRequests, setPtRequests] = useState<PtSessionRequest[]>([]);
  const [ptResponseValues, setPtResponseValues] = useState<
    Record<string, { proposedStart: string; response: string }>
  >({});
  const [updatingPtRequestId, setUpdatingPtRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedWeekStart = useMemo(() => getMondayOf(selectedDate), [selectedDate]);

  const readableDate = useMemo(() => {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedDate]);
  const getDaysSinceLogin = (lastSignIn: string | null) => {
    if (!lastSignIn) return null;

    const now = new Date();
    const lastLogin = new Date(lastSignIn);
    const diffMs = now.getTime() - lastLogin.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  const getLastActiveText = (lastSignIn: string | null) => {
    const days = getDaysSinceLogin(lastSignIn);

    if (days === null) return "Never logged in";
    if (days === 0) return "Active today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const getLastActiveColor = (lastSignIn: string | null) => {
    const days = getDaysSinceLogin(lastSignIn);

    if (days === null) return "text-red-600";
    if (days === 0) return "text-green-600";
    if (days <= 3) return "text-green-600";
    if (days <= 7) return "text-amber-600";
    return "text-red-600"; // 8+ days
  };

  const formatSessionDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const attentionItems = useMemo(() => {
    const items: Array<{
      key: string;
      clientId: string;
      clientName: string;
      title: string;
      detail: string;
      tone: "gold" | "red" | "amber";
    }> = [];

    unreadMessages.forEach((message) => {
      items.push({
        key: `message-${message.id}`,
        clientId: message.client_id,
        clientName: message.client_name,
        title: "Unread message",
        detail: message.context_label || message.body,
        tone: "gold",
      });
    });

    clientCards.forEach((card) => {
      const daysSinceLogin = getDaysSinceLogin(card.client.last_sign_in_at);
      if (daysSinceLogin !== null && daysSinceLogin > 7) {
        items.push({
          key: `inactive-${card.client.id}`,
          clientId: card.client.id,
          clientName: card.client.full_name,
          title: "Inactive over a week",
          detail: `Last active ${daysSinceLogin} days ago`,
          tone: "red",
        });
      }

      const hasWeeklyCheckIn = weeklyCheckIns.some(
        (checkIn) => checkIn.client_id === card.client.id
      );
      if (!hasWeeklyCheckIn) {
        items.push({
          key: `checkin-${card.client.id}`,
          clientId: card.client.id,
          clientName: card.client.full_name,
          title: "Weekly check-in missing",
          detail: "No check-in submitted for this week",
          tone: "amber",
        });
      }
    });

    return items.slice(0, 10);
  }, [clientCards, unreadMessages, weeklyCheckIns]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, email, calorie_target, daily_step_target, profile_id")
        .order("full_name", { ascending: true });

      if (clientsError || !clientsData) {
        setClientCards([]);
        setLoading(false);
        return;
      }

      // Get auth data for all clients
      const clientsWithAuth = await Promise.all(
        clientsData.map(async (client) => {
          if (!client.profile_id) {
            return { ...client, last_sign_in_at: null };
          }

          // Get last sign in from auth.users via profiles
          const { data: authData } = await supabase
            .from("profiles")
            .select("last_sign_in_at")
            .eq("id", client.profile_id)
            .single();

          return {
            ...client,
            last_sign_in_at: authData?.last_sign_in_at || null,
          };
        })
      );

      const clients = clientsWithAuth as Client[];
      const clientIds = clients.map((client) => client.id);
      const clientNameMap = new Map(
        clients.map((client) => [client.id, client.full_name])
      );

      let setLogs: WorkoutSetLog[] = [];
      let mealLogs: MealLogRow[] = [];
      let dailyTrackingData: DailyTracking[] = [];

      if (clientIds.length > 0) {
        const dayStart = `${selectedDate}T00:00:00`;
        const dayEnd = `${selectedDate}T23:59:59`;

        const { data: setLogData } = await supabase
          .from("client_program_set_logs")
          .select(
            "id, client_id, client_program_day_id, client_program_day_exercise_id, completed, created_at"
          )
          .in("client_id", clientIds)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);

        if (setLogData) {
          setLogs = setLogData as WorkoutSetLog[];
        }

        const { data: mealLogData } = await supabase
          .from("meal_logs")
          .select("client_id, quantity, recipes(calories)")
          .in("client_id", clientIds)
          .eq("log_date", selectedDate)
          .eq("completed", true);

        if (mealLogData) {
          mealLogs = mealLogData as MealLogRow[];
        }

        // Load daily tracking
        const { data: trackingData } = await supabase
          .from("daily_tracking")
          .select("*")
          .in("client_id", clientIds)
          .eq("log_date", selectedDate);

        if (trackingData) {
          dailyTrackingData = trackingData as DailyTracking[];
        }

        const { data: messageData } = await supabase
          .from("client_messages")
          .select("id, client_id, body, context_label, created_at")
          .in("client_id", clientIds)
          .eq("sender_role", "client")
          .is("read_by_trainer_at", null)
          .order("created_at", { ascending: false })
          .limit(5);

        setUnreadMessages(
          (messageData ?? []).map((message) => ({
            ...message,
            client_name: clientNameMap.get(message.client_id) ?? "Client",
          }))
        );

        const { data: checkInData } = await supabase
          .from("client_weekly_check_ins")
          .select("client_id, week_start")
          .in("client_id", clientIds)
          .eq("week_start", selectedWeekStart);

        setWeeklyCheckIns((checkInData ?? []) as WeeklyCheckIn[]);

        const { data: ptRequestData } = await supabase
          .from("pt_session_requests")
          .select("*")
          .in("client_id", clientIds)
          .in("status", ["requested", "alternative_suggested"])
          .order("created_at", { ascending: false })
          .limit(10);

        const requests = ((ptRequestData ?? []) as PtSessionRequest[]).map(
          (request) => ({
            ...request,
            client_name: clientNameMap.get(request.client_id) ?? "Client",
          })
        );

        setPtRequests(requests);
        setPtResponseValues(
          Object.fromEntries(
            requests.map((request) => [
              request.id,
              {
                proposedStart: "",
                response: request.trainer_response ?? "",
              },
            ])
          )
        );
      } else {
        setUnreadMessages([]);
        setWeeklyCheckIns([]);
        setPtRequests([]);
      }

      const exerciseIds = Array.from(
        new Set(setLogs.map((log) => log.client_program_day_exercise_id))
      );

      let programExercises: ProgramExercise[] = [];
      if (exerciseIds.length > 0) {
        const { data: exerciseData } = await supabase
          .from("client_program_day_exercises")
          .select("id, client_program_day_id, sets")
          .in("id", exerciseIds);

        if (exerciseData) {
          programExercises = exerciseData as ProgramExercise[];
        }
      }

      const exerciseMap = new Map(programExercises.map((e) => [e.id, e]));
      const trackingMap = new Map(dailyTrackingData.map((t) => [t.client_id, t]));

      const cards: ClientStatusCard[] = clients.map((client) => {
        const clientWorkoutLogs = setLogs.filter((log) => log.client_id === client.id);
        const clientTracking = trackingMap.get(client.id);

        let workoutStatus: ClientStatusCard["workout"];

        if (clientWorkoutLogs.length === 0) {
          workoutStatus = {
            status: "red",
            label: "No workout logged",
          };
        } else {
          const completedSetCounts = new Map<string, number>();
          const exerciseTargets = new Map<string, number>();

          for (const log of clientWorkoutLogs) {
            const currentCompleted = completedSetCounts.get(log.client_program_day_exercise_id) ?? 0;
            if (log.completed) {
              completedSetCounts.set(log.client_program_day_exercise_id, currentCompleted + 1);
            } else if (!completedSetCounts.has(log.client_program_day_exercise_id)) {
              completedSetCounts.set(log.client_program_day_exercise_id, 0);
            }

            const exercise = exerciseMap.get(log.client_program_day_exercise_id);
            if (exercise) {
              exerciseTargets.set(
                log.client_program_day_exercise_id,
                exercise.sets ?? 0
              );
            }
          }

          const exerciseIdsForClient = Array.from(exerciseTargets.keys());

          const fullyCompletedExercises = exerciseIdsForClient.filter((exerciseId) => {
            const targetSets = exerciseTargets.get(exerciseId) ?? 0;
            const completedSets = completedSetCounts.get(exerciseId) ?? 0;
            return targetSets > 0 && completedSets >= targetSets;
          }).length;

          const totalTrackedExercises = exerciseIdsForClient.length;

          if (totalTrackedExercises > 0 && fullyCompletedExercises === totalTrackedExercises) {
            workoutStatus = {
              status: "green",
              label: `${fullyCompletedExercises}/${totalTrackedExercises} exercises complete`,
            };
          } else {
            workoutStatus = {
              status: "amber",
              label: `${fullyCompletedExercises}/${totalTrackedExercises || 0} exercises complete`,
            };
          }
        }

        const clientMealLogs = mealLogs.filter((log) => log.client_id === client.id);

        let totalCalories = 0;
        for (const meal of clientMealLogs) {
          const recipeCalories = Array.isArray(meal.recipes)
            ? meal.recipes[0]?.calories
            : meal.recipes?.calories;

          totalCalories += (recipeCalories ?? 0) * (meal.quantity ?? 1);
        }

        let nutritionStatus: ClientStatusCard["nutrition"];

        if (client.calorie_target === null || client.calorie_target === undefined) {
          nutritionStatus = {
            status: "red",
            label: `${totalCalories} kcal logged`,
          };
        } else {
          const diff = Math.abs(client.calorie_target - totalCalories);

          if (diff <= 100) {
            nutritionStatus = {
              status: "green",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          } else if (diff <= 300) {
            nutritionStatus = {
              status: "amber",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          } else {
            nutritionStatus = {
              status: "red",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          }
        }

        return {
          client,
          workout: workoutStatus,
          nutrition: nutritionStatus,
          steps: clientTracking?.steps_logged ?? null,
          waterCompleted: clientTracking?.water_completed ?? false,
        };
      });

      setClientCards(cards);
      setLoading(false);
    };

    loadDashboard();
  }, [selectedDate]);

  const updatePtRequest = async (
    request: PtSessionRequest,
    action: "confirm" | "suggest" | "decline"
  ) => {
    const values = ptResponseValues[request.id] ?? {
      proposedStart: "",
      response: "",
    };

    if (action === "suggest" && !values.proposedStart) {
      alert("Please choose an alternative date and time.");
      return;
    }

    setUpdatingPtRequestId(request.id);

    const now = new Date().toISOString();
    const payload =
      action === "confirm"
        ? {
            status: "confirmed",
            confirmed_start_at: request.preferred_start_at,
            trainer_response: values.response.trim() || null,
            responded_at: now,
            updated_at: now,
          }
        : action === "suggest"
          ? {
              status: "alternative_suggested",
              proposed_start_at: new Date(values.proposedStart).toISOString(),
              trainer_response:
                values.response.trim() ||
                "Peter has suggested an alternative time.",
              responded_at: now,
              updated_at: now,
            }
          : {
              status: "declined",
              trainer_response: values.response.trim() || null,
              responded_at: now,
              updated_at: now,
            };

    const { data, error } = await supabase
      .from("pt_session_requests")
      .update(payload)
      .eq("id", request.id)
      .select()
      .single();

    if (error || !data) {
      alert("Could not update PT request.");
      setUpdatingPtRequestId(null);
      return;
    }

    setPtRequests((prev) =>
      action === "confirm" || action === "decline"
        ? prev.filter((item) => item.id !== request.id)
        : prev.map((item) =>
            item.id === request.id
              ? { ...(data as PtSessionRequest), client_name: request.client_name }
              : item
          )
    );
    setUpdatingPtRequestId(null);
  };

  return (
    <>
      <h1 className={styles.display}>Trainer Dashboard</h1>

      <div className={`${styles.card} mt-6 mb-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Viewing status for</p>
            <p className="text-lg font-semibold text-ink">{readableDate}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className={styles.buttonSecondary}
            >
              Previous Day
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getDateString(new Date()))}
              className={styles.buttonSecondary}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              className={styles.buttonSecondary}
            >
              Next Day
            </button>
          </div>
        </div>
      </div>


      {!loading && attentionItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-border-subtle bg-surface-raised p-5 shadow-subtle">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Needs Attention
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"} to review
          </h2>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {attentionItems.map((item) => (
              <Link
                key={item.key}
                href={`/trainer/clients/${item.clientId}`}
                className={`block rounded-lg border px-4 py-3 transition hover:bg-surface-sunken ${
                  item.tone === "red"
                    ? "border-red-300 bg-red-50"
                    : item.tone === "gold"
                    ? "border-gold bg-gold/10"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{item.clientName}</p>
                <p className="mt-1 text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{item.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && ptRequests.length > 0 && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 p-5 shadow-subtle">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-surface-raised p-2 text-gold">
              <CalendarClock size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Online PT requests
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {ptRequests.length} request{ptRequests.length === 1 ? "" : "s"} to review
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {ptRequests.map((request) => {
              const values = ptResponseValues[request.id] ?? {
                proposedStart: "",
                response: "",
              };

              return (
                <div
                  key={request.id}
                  className="rounded-lg border border-border-subtle bg-surface-raised p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{request.client_name}</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        Preferred: {formatSessionDateTime(request.preferred_start_at)}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Status: {request.status.replaceAll("_", " ")}
                      </p>
                      {request.client_note && (
                        <p className="mt-2 text-sm text-ink-muted">
                          Client note: {request.client_note}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => updatePtRequest(request, "confirm")}
                      disabled={updatingPtRequestId === request.id}
                      className={styles.buttonPrimary}
                    >
                      Confirm preferred
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] md:items-end">
                    <div>
                      <label className="text-sm font-medium text-ink">
                        Alternative time
                      </label>
                      <input
                        type="datetime-local"
                        value={values.proposedStart}
                        onChange={(event) =>
                          setPtResponseValues((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...values,
                              proposedStart: event.target.value,
                            },
                          }))
                        }
                        className={styles.input}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-ink">
                        Response
                      </label>
                      <input
                        value={values.response}
                        onChange={(event) =>
                          setPtResponseValues((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...values,
                              response: event.target.value,
                            },
                          }))
                        }
                        placeholder="Optional message"
                        className={styles.input}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => updatePtRequest(request, "suggest")}
                      disabled={updatingPtRequestId === request.id}
                      className={styles.buttonSecondary}
                    >
                      Suggest time
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePtRequest(request, "decline")}
                      disabled={updatingPtRequestId === request.id}
                      className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.body}>Loading dashboard...</p>
      ) : clientCards.length === 0 ? (
        <p className={styles.body}>No clients found.</p>
      ) : (
        <div className="space-y-4">
          {clientCards.map((card) => (
            <Link
              key={card.client.id}
              href={`/trainer/clients/${card.client.id}`}
              className="block"
            >
              <div className={`${styles.card} hover:bg-surface-sunken transition`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      {card.client.full_name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {card.client.email}
                    </p>
                    <p className={`mt-1 text-xs font-medium ${getLastActiveColor(card.client.last_sign_in_at)}`}>
                      Last active: {getLastActiveText(card.client.last_sign_in_at)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Workout Card */}
                    <div
                      className={`rounded-xl px-4 py-3 ${getStatusClasses(
                        card.workout.status
                      )}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Workout
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {card.workout.label}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        Steps: {card.steps?.toLocaleString() ?? "0"} / {card.client.daily_step_target.toLocaleString()}
                      </p>
                    </div>

                    {/* Nutrition Card */}
                    <div
                      className={`rounded-xl px-4 py-3 ${getStatusClasses(
                        card.nutrition.status
                      )}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Nutrition
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {card.nutrition.label}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        Water: {card.waterCompleted ? "Complete âœ“" : "Not logged"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}




