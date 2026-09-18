import { describe, expect, it, vi } from "vitest";
import { createAsyncResource } from "../../src/utils/asyncResource";

describe("createAsyncResource", () => {
  it("shares concurrent loads and retains a stable snapshot until data changes", async () => {
    const fetchData = vi.fn().mockResolvedValue([1]);
    const resource = createAsyncResource<number[]>([], fetchData);
    expect(resource.getSnapshot()).toBe(resource.getSnapshot());
    await Promise.all([resource.load(), resource.load(), resource.load()]);
    await resource.load();
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(resource.getSnapshot()).toEqual({ data: [1], loading: false, error: null });
  });

  it("refreshes again when a plugin changes while a read is pending", async () => {
    let resolve!: (value: number) => void;
    const fetchData = vi.fn().mockImplementationOnce(() => new Promise<number>((done) => { resolve = done; }))
      .mockResolvedValue(2);
    const resource = createAsyncResource(0, fetchData);
    const pending = resource.load();
    await Promise.resolve();
    const refresh = resource.refresh();
    resolve(1);
    await Promise.all([pending, refresh]);
    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(resource.getSnapshot().data).toBe(2);
  });

  it("preserves usable data on errors, supports retry, and unsubscribes", async () => {
    const fetchData = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(2);
    const resource = createAsyncResource(0, fetchData);
    const listener = vi.fn();
    const unsubscribe = resource.subscribe(listener);
    await resource.load();
    await resource.refresh();
    expect(resource.getSnapshot()).toEqual({ data: 1, loading: false, error: "Error: offline" });
    unsubscribe();
    listener.mockClear();
    await resource.refresh();
    expect(resource.getSnapshot().data).toBe(2);
    expect(listener).not.toHaveBeenCalled();
  });
});
