import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  pushMock: vi.fn(),
  signInActionMock: vi.fn(),
  signUpActionMock: vi.fn(),
  getAnonWorkDataMock: vi.fn(),
  clearAnonWorkMock: vi.fn(),
  getProjectsMock: vi.fn(),
  createProjectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.pushMock }),
}));

vi.mock("@/actions", () => ({
  signIn: mocks.signInActionMock,
  signUp: mocks.signUpActionMock,
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mocks.getAnonWorkDataMock,
  clearAnonWork: mocks.clearAnonWorkMock,
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: mocks.getProjectsMock,
}));

vi.mock("@/actions/create-project", () => ({
  createProject: mocks.createProjectMock,
}));

import { useAuth } from "@/hooks/use-auth";

beforeEach(() => {
  mocks.pushMock.mockReset();
  mocks.signInActionMock.mockReset();
  mocks.signUpActionMock.mockReset();
  mocks.getAnonWorkDataMock.mockReset();
  mocks.clearAnonWorkMock.mockReset();
  mocks.getProjectsMock.mockReset();
  mocks.createProjectMock.mockReset();

  mocks.getAnonWorkDataMock.mockReturnValue(null);
  mocks.getProjectsMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

test("signIn forwards credentials to the server action and returns its result", async () => {
  mocks.signInActionMock.mockResolvedValue({
    success: false,
    error: "Invalid credentials",
  });

  const { result } = renderHook(() => useAuth());

  let returned: any;
  await act(async () => {
    returned = await result.current.signIn("a@b.com", "wrong");
  });

  expect(mocks.signInActionMock).toHaveBeenCalledWith("a@b.com", "wrong");
  expect(returned).toEqual({ success: false, error: "Invalid credentials" });
});

test("signIn failure does not trigger navigation or post-sign-in work", async () => {
  mocks.signInActionMock.mockResolvedValue({
    success: false,
    error: "Invalid credentials",
  });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("a@b.com", "wrong");
  });

  expect(mocks.pushMock).not.toHaveBeenCalled();
  expect(mocks.getProjectsMock).not.toHaveBeenCalled();
  expect(mocks.createProjectMock).not.toHaveBeenCalled();
  expect(mocks.clearAnonWorkMock).not.toHaveBeenCalled();
});

test("signUp forwards credentials to the server action and returns its result", async () => {
  mocks.signUpActionMock.mockResolvedValue({
    success: false,
    error: "Email already registered",
  });

  const { result } = renderHook(() => useAuth());

  let returned: any;
  await act(async () => {
    returned = await result.current.signUp("x@y.com", "pass1234");
  });

  expect(mocks.signUpActionMock).toHaveBeenCalledWith("x@y.com", "pass1234");
  expect(returned).toEqual({
    success: false,
    error: "Email already registered",
  });
});

test("successful signIn with anonymous work creates project from anon data and clears storage", async () => {
  mocks.signInActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue({
    messages: [{ id: "m1", role: "user", content: "hi" }],
    fileSystemData: {
      "/App.jsx": {
        type: "file",
        name: "App.jsx",
        path: "/App.jsx",
        content: "x",
      },
    },
  });
  mocks.createProjectMock.mockResolvedValue({ id: "anon-proj" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("a@b.com", "pass1234");
  });

  expect(mocks.createProjectMock).toHaveBeenCalledOnce();
  const payload = mocks.createProjectMock.mock.calls[0][0];
  expect(payload.name).toMatch(/^Design from /);
  expect(payload.messages).toEqual([{ id: "m1", role: "user", content: "hi" }]);
  expect(payload.data).toEqual({
    "/App.jsx": {
      type: "file",
      name: "App.jsx",
      path: "/App.jsx",
      content: "x",
    },
  });

  expect(mocks.clearAnonWorkMock).toHaveBeenCalledOnce();
  expect(mocks.getProjectsMock).not.toHaveBeenCalled();
  expect(mocks.pushMock).toHaveBeenCalledWith("/anon-proj");
});

test("successful signIn with no anon work navigates to the most recent project", async () => {
  mocks.signInActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue(null);
  mocks.getProjectsMock.mockResolvedValue([
    { id: "latest" },
    { id: "older" },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("a@b.com", "pass1234");
  });

  expect(mocks.pushMock).toHaveBeenCalledWith("/latest");
  expect(mocks.createProjectMock).not.toHaveBeenCalled();
  expect(mocks.clearAnonWorkMock).not.toHaveBeenCalled();
});

test("anon work with zero messages is treated as no anon work", async () => {
  mocks.signInActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue({
    messages: [],
    fileSystemData: {},
  });
  mocks.getProjectsMock.mockResolvedValue([{ id: "existing" }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("a@b.com", "pass1234");
  });

  expect(mocks.clearAnonWorkMock).not.toHaveBeenCalled();
  expect(mocks.createProjectMock).not.toHaveBeenCalled();
  expect(mocks.pushMock).toHaveBeenCalledWith("/existing");
});

test("successful signUp with no prior projects creates an empty project and navigates", async () => {
  mocks.signUpActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue(null);
  mocks.getProjectsMock.mockResolvedValue([]);
  mocks.createProjectMock.mockResolvedValue({ id: "fresh" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@user.com", "pass1234");
  });

  expect(mocks.createProjectMock).toHaveBeenCalledOnce();
  const payload = mocks.createProjectMock.mock.calls[0][0];
  expect(payload.name).toMatch(/^New Design #\d+$/);
  expect(payload.messages).toEqual([]);
  expect(payload.data).toEqual({});
  expect(mocks.pushMock).toHaveBeenCalledWith("/fresh");
});

test("successful signUp with anon work takes the anon-work branch", async () => {
  mocks.signUpActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue({
    messages: [{ id: "m1", role: "user", content: "draft" }],
    fileSystemData: {},
  });
  mocks.createProjectMock.mockResolvedValue({ id: "anon-on-signup" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("u@v.com", "pass1234");
  });

  expect(mocks.clearAnonWorkMock).toHaveBeenCalledOnce();
  expect(mocks.getProjectsMock).not.toHaveBeenCalled();
  expect(mocks.pushMock).toHaveBeenCalledWith("/anon-on-signup");
});

test("isLoading starts as false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

test("isLoading is true while signIn is in flight and resets after completion", async () => {
  let resolveSignIn!: (value: any) => void;
  mocks.signInActionMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
  );

  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);

  let signInPromise: Promise<any>;
  act(() => {
    signInPromise = result.current.signIn("a@b.com", "pass1234");
  });

  await waitFor(() => expect(result.current.isLoading).toBe(true));

  await act(async () => {
    resolveSignIn({ success: false });
    await signInPromise;
  });

  expect(result.current.isLoading).toBe(false);
});

test("isLoading resets to false when the server action rejects", async () => {
  mocks.signInActionMock.mockRejectedValue(new Error("network"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await expect(
      result.current.signIn("a@b.com", "pass1234")
    ).rejects.toThrow("network");
  });

  expect(result.current.isLoading).toBe(false);
});

test("isLoading resets to false even if post-sign-in work fails", async () => {
  mocks.signInActionMock.mockResolvedValue({ success: true });
  mocks.getAnonWorkDataMock.mockReturnValue(null);
  mocks.getProjectsMock.mockRejectedValue(new Error("db down"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await expect(
      result.current.signIn("a@b.com", "pass1234")
    ).rejects.toThrow("db down");
  });

  expect(result.current.isLoading).toBe(false);
  expect(mocks.pushMock).not.toHaveBeenCalled();
});
