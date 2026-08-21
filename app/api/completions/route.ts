import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const POINTS_PER_LEVEL = 100;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { task_id } = body;

  if (!task_id) {
    return NextResponse.json({ error: "task_id is required" }, { status: 400 });
  }

  // Look up the task to get its point value — also confirms it belongs to this user via RLS
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("points")
    .eq("id", task_id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Block completing the same task more than once today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from("completions")
    .select("id")
    .eq("task_id", task_id)
    .eq("user_id", user.id)
    .gte("completed_at", startOfDay.toISOString())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Task already completed today" },
      { status: 409 }
    );
  }

  // Log the completion
  const { data: completion, error: completionError } = await supabase
    .from("completions")
    .insert({ task_id, user_id: user.id })
    .select()
    .single();

  if (completionError) {
    return NextResponse.json(
      { error: completionError.message },
      { status: 500 }
    );
  }

  // Get current stats, or treat as zero if this is the user's first completion
  const { data: stats } = await supabase
    .from("user_stats")
    .select("total_points")
    .eq("user_id", user.id)
    .single();

  const newTotal = (stats?.total_points ?? 0) + task.points;
  const newLevel = Math.floor(newTotal / POINTS_PER_LEVEL) + 1;

  // Upsert since a first-time user has no user_stats row yet
  const { data: updatedStats, error: statsError } = await supabase
    .from("user_stats")
    .upsert(
      { user_id: user.id, total_points: newTotal, current_level: newLevel },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  return NextResponse.json(
    { completion, stats: updatedStats },
    { status: 201 }
  );
}
