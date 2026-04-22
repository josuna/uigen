"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

interface Props {
  toolInvocation: ToolInvocation;
}

function basename(path: string | undefined): string {
  if (!path) return "";
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

const STATUS: Record<string, Record<string, [string, string]>> = {
  str_replace_editor: {
    create: ["Creating", "Created"],
    str_replace: ["Editing", "Edited"],
    insert: ["Editing", "Edited"],
    view: ["Viewing", "Viewed"],
    undo_edit: ["Undoing", "Undone"],
  },
  file_manager: {
    rename: ["Renaming", "Renamed"],
    delete: ["Deleting", "Deleted"],
  },
};

export function formatToolLabel(
  toolInvocation: ToolInvocation,
  isDone: boolean
): string {
  const { toolName, args } = toolInvocation as { toolName: string; args: any };
  const cmdTable = STATUS[toolName];
  const statusPair = cmdTable && args?.command ? cmdTable[args.command] : undefined;
  if (!statusPair) return toolName;

  const status = isDone ? statusPair[1] : statusPair[0];
  const name = basename(args?.path);

  if (toolName === "file_manager" && args?.command === "rename") {
    const newName = basename(args?.new_path);
    if (name && newName) return `${name} → ${newName} · ${status}`;
  }

  if (!name) return status;
  return `${name} · ${status}`;
}

export function ToolInvocationBadge({ toolInvocation }: Props) {
  const isDone =
    toolInvocation.state === "result" &&
    (toolInvocation as any).result !== undefined;
  const label = formatToolLabel(toolInvocation, isDone);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
