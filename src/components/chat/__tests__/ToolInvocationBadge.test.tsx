import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolInvocation } from "ai";
import {
  ToolInvocationBadge,
  formatToolLabel,
} from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  overrides: Partial<ToolInvocation> & { toolName: string; args: any }
): ToolInvocation {
  return {
    toolCallId: "call_test",
    state: "call",
    step: 0,
    ...overrides,
  } as unknown as ToolInvocation;
}

test("formatToolLabel: str_replace_editor create, in progress", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "/components/Counter.jsx" },
  });
  expect(formatToolLabel(inv, false)).toBe("Counter.jsx · Creating");
});

test("formatToolLabel: str_replace_editor create, done", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "/components/Counter.jsx" },
  });
  expect(formatToolLabel(inv, true)).toBe("Counter.jsx · Created");
});

test("formatToolLabel: str_replace_editor str_replace, done", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "str_replace", path: "/App.jsx" },
  });
  expect(formatToolLabel(inv, true)).toBe("App.jsx · Edited");
});

test("formatToolLabel: str_replace_editor insert shares copy with str_replace", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "insert", path: "/App.jsx" },
  });
  expect(formatToolLabel(inv, false)).toBe("App.jsx · Editing");
  expect(formatToolLabel(inv, true)).toBe("App.jsx · Edited");
});

test("formatToolLabel: str_replace_editor view, nested path picks basename", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "view", path: "/a/b/c.ts" },
  });
  expect(formatToolLabel(inv, false)).toBe("c.ts · Viewing");
  expect(formatToolLabel(inv, true)).toBe("c.ts · Viewed");
});

test("formatToolLabel: str_replace_editor undo_edit", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "undo_edit", path: "/x.jsx" },
  });
  expect(formatToolLabel(inv, false)).toBe("x.jsx · Undoing");
  expect(formatToolLabel(inv, true)).toBe("x.jsx · Undone");
});

test("formatToolLabel: file_manager rename shows both names, done", () => {
  const inv = makeInvocation({
    toolName: "file_manager",
    args: { command: "rename", path: "/a.jsx", new_path: "/b.jsx" },
  });
  expect(formatToolLabel(inv, true)).toBe("a.jsx → b.jsx · Renamed");
});

test("formatToolLabel: file_manager rename without new_path falls back to single name", () => {
  const inv = makeInvocation({
    toolName: "file_manager",
    args: { command: "rename", path: "/a.jsx" },
  });
  expect(formatToolLabel(inv, false)).toBe("a.jsx · Renaming");
});

test("formatToolLabel: file_manager delete, done", () => {
  const inv = makeInvocation({
    toolName: "file_manager",
    args: { command: "delete", path: "/trash.jsx" },
  });
  expect(formatToolLabel(inv, true)).toBe("trash.jsx · Deleted");
});

test("formatToolLabel: empty args falls back to tool name", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: {},
  });
  expect(formatToolLabel(inv, false)).toBe("str_replace_editor");
  expect(formatToolLabel(inv, true)).toBe("str_replace_editor");
});

test("formatToolLabel: unknown tool name falls back to tool name", () => {
  const inv = makeInvocation({
    toolName: "some_future_tool",
    args: { command: "create", path: "/foo" },
  });
  expect(formatToolLabel(inv, false)).toBe("some_future_tool");
});

test("formatToolLabel: create without path yet renders just status", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create" },
  });
  expect(formatToolLabel(inv, false)).toBe("Creating");
});

test("formatToolLabel: basename handles bare filename and trailing slash", () => {
  const bare = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "Counter.jsx" },
  });
  expect(formatToolLabel(bare, false)).toBe("Counter.jsx · Creating");

  const trailing = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "view", path: "/components/" },
  });
  expect(formatToolLabel(trailing, true)).toBe("components · Viewed");
});

test("ToolInvocationBadge: partial-call shows spinner and in-progress label", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    state: "partial-call",
    args: { command: "create", path: "/App.jsx" },
  });
  const { container } = render(<ToolInvocationBadge toolInvocation={inv} />);

  expect(screen.getByText("App.jsx · Creating")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolInvocationBadge: result state with result shows green dot and done label", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    state: "result",
    args: { command: "create", path: "/App.jsx" },
    result: "Successfully created /App.jsx",
  } as any);
  const { container } = render(<ToolInvocationBadge toolInvocation={inv} />);

  expect(screen.getByText("App.jsx · Created")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolInvocationBadge: call state (no result yet) shows spinner", () => {
  const inv = makeInvocation({
    toolName: "str_replace_editor",
    state: "call",
    args: { command: "str_replace", path: "/x.jsx" },
  });
  const { container } = render(<ToolInvocationBadge toolInvocation={inv} />);

  expect(screen.getByText("x.jsx · Editing")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
});
