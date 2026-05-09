"use client";

import { Check, Lock } from "lucide-react";

export function StepBadge({ num, done, locked, label }: {
  num: number | string;
  done: boolean;
  locked?: boolean;
  label?: string;
}) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
      done ? "bg-emerald-500 text-white"
        : locked ? "bg-pearl-200 text-gray-400"
        : "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
    }`}>
      {done ? <Check className="w-4 h-4" /> : locked ? <Lock className="w-3 h-3" /> : label ?? num}
    </div>
  );
}
