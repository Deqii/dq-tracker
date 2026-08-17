"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  title: string;
  category: string | null;
  points: number;
};

export default function TodayPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!cancelled) {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleComplete = async (taskId: string) => {
    if (completedIds.has(taskId)) return; // prevent double-tap

    const res = await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
    });

    if (!res.ok) return;

    const { stats } = await res.json();
    setCompletedIds((prev) => new Set(prev).add(taskId));
    setTotalPoints(stats.total_points);
    setLevel(stats.current_level);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-md p-6">
      {userEmail && (
        <p className="mb-2 text-sm text-gray-500">Signed in as {userEmail}</p>
      )}
      <div className="mb-6 flex items-center justify-between rounded border p-4">
        <span className="font-bold">Level {level ?? "—"}</span>
        <span>{totalPoints ?? "—"} pts</span>
      </div>

      <h1 className="mb-4 text-xl font-bold">Today</h1>

      {tasks.length === 0 && (
        <p className="text-gray-500">No tasks yet. Add one to get started.</p>
      )}

      <ul className="space-y-2">
        {tasks.map((task) => {
          const done = completedIds.has(task.id);
          return (
            <li
              key={task.id}
              className={`flex items-center justify-between rounded border p-3 ${
                done ? "opacity-50" : ""
              }`}
            >
              <div>
                <p className={done ? "line-through" : ""}>{task.title}</p>
                {task.category && (
                  <span className="text-xs text-gray-500">{task.category}</span>
                )}
              </div>
              <button
                onClick={() => handleComplete(task.id)}
                disabled={done}
                className={`cursor-pointer shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  done
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {done ? "✓ Done" : `Complete +${task.points}`}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
