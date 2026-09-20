import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeDiscovery, ThemeRegistryInstall } from "../../../src/components/settings/ThemeDiscovery";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), refreshCatalog: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("../../../src/hooks/useTheme", () => ({ useTheme: () => ({ catalog: { themes: [] }, refreshCatalog: mocks.refreshCatalog }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, args?: { count?: string }) => args?.count ? `${key}: ${args.count}` : key, i18n: { language: "en" } }) }));
vi.mock("../../../src/components/modals/PluginReadmeModal", () => ({ PluginReadmeModal: () => <div>Read-only README</div> }));

const plugin = { id: "fixture-theme", name: "Fixture theme", description: "Test", author: "Author", latest_version: "1.0.0", downloads: 1200, releases: [{ version: "1.0.0", min_tabularis_version: "0.24.0", assets: { universal: "https://example.invalid/theme.zip" } }] };
const snapshot = { registryKey: "a".repeat(64), registryUrl: "https://example.invalid", plugins: [plugin] };

beforeEach(() => {
  vi.clearAllMocks(); mocks.refreshCatalog.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation(async (command) => {
    if (command === "fetch_theme_registry") return snapshot;
    if (command === "fetch_theme_package_detail") return plugin;
    if (command === "install_registry_theme") return { warnings: [] };
    throw new Error(`Unexpected ${command}`);
  });
});

describe("theme discovery and explicit install", () => {
  it("displays locale-aware compact and exact counts without installing on discovery or details", async () => {
    render(<ThemeDiscovery isOpen onClose={vi.fn()} />);
    await screen.findByText("Fixture theme");
    expect(screen.getByLabelText("themePackages.downloads: 1,200")).toHaveTextContent("1.2K");
    fireEvent.click(screen.getByRole("button", { name: "themePackages.details" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.install" })).toBeEnabled());
    expect(mocks.invoke.mock.calls.map(([command]) => command)).toEqual(["fetch_theme_registry", "fetch_theme_package_detail"]);
    fireEvent.click(screen.getByRole("button", { name: "themePackages.install" }));
    await screen.findByText("themePackages.installedHint");
    expect(mocks.invoke).toHaveBeenCalledWith("install_registry_theme", { packageName: plugin.id, expectedRegistryKey: snapshot.registryKey, version: null });
    expect(mocks.invoke.mock.calls.some(([command]) => command === "save_config" || command === "install_plugin")).toBe(false);
  });
  it("pins explicit releases and binds deep-link registry before confirmation", async () => {
    render(<ThemeRegistryInstall isOpen onClose={vi.fn()} snapshot={snapshot} plugin={plugin} initialVersion="1.0.0" requestedRegistry="https://example.invalid" onCommitted={mocks.refreshCatalog} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.install" })).toBeEnabled());
    expect(mocks.invoke).toHaveBeenCalledWith("fetch_theme_package_detail", expect.objectContaining({ requestedRegistryUrl: "https://example.invalid" }));
    fireEvent.click(screen.getByRole("button", { name: "themePackages.install" }));
    await screen.findByText("themePackages.installedHint");
    expect(mocks.invoke).toHaveBeenCalledWith("install_registry_theme", expect.objectContaining({ version: "1.0.0" }));
  });
  it("keeps committed success distinct from failed refresh and prevents duplicate downloads", async () => {
    mocks.refreshCatalog.mockRejectedValueOnce(new Error("refresh failed"));
    render(<ThemeRegistryInstall isOpen onClose={vi.fn()} snapshot={snapshot} plugin={plugin} onCommitted={mocks.refreshCatalog} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.install" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "themePackages.install" }));
    await screen.findByText(/themePackages.committedRefreshFailed/);
    expect(screen.getByRole("button", { name: "themePackages.install" })).toBeDisabled();
    expect(mocks.invoke.mock.calls.filter(([command]) => command === "install_registry_theme")).toHaveLength(1);
  });
  it("blocks incompatible versions and presents metadata failures without downloads", async () => {
    mocks.invoke.mockResolvedValueOnce({ ...plugin, releases: [{ ...plugin.releases[0], min_tabularis_version: "99.0.0" }] });
    render(<ThemeRegistryInstall isOpen onClose={vi.fn()} snapshot={snapshot} plugin={plugin} onCommitted={mocks.refreshCatalog} />);
    await screen.findByText("themePackages.incompatible");
    expect(screen.getByRole("button", { name: "themePackages.install" })).toBeDisabled();
    expect(mocks.invoke).toHaveBeenCalledOnce();
  });
  it("binds update to the installed registry/package without listing unrelated packages", async () => {
    const close = vi.fn();
    render(<ThemeDiscovery isOpen onClose={close} expectedPackage={{ registryKey: snapshot.registryKey, packageName: plugin.id }} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.install" })).toBeEnabled());
    expect(mocks.invoke).toHaveBeenCalledWith("fetch_theme_registry", { packageName: plugin.id, expectedRegistryKey: snapshot.registryKey });
    expect(screen.queryByRole("button", { name: "themePackages.details" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
    expect(mocks.invoke.mock.calls.some(([command]) => command === "install_registry_theme")).toBe(false);
  });
  it.each([false, true])("refuses a different configured registry without installing (native rejection: %s)", async (nativeRejection) => {
    if (nativeRejection) mocks.invoke.mockRejectedValueOnce("Configured theme registry changed; refresh discovery");
    render(<ThemeDiscovery isOpen onClose={vi.fn()} expectedPackage={{ registryKey: "b".repeat(64), packageName: plugin.id }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("themePackages.registryMismatch");
    expect(screen.queryByRole("button", { name: "themePackages.install" })).not.toBeInTheDocument(); expect(mocks.invoke).toHaveBeenCalledOnce();
  });
  it("returns keyboard focus to the invoking details button", async () => {
    render(<ThemeDiscovery isOpen onClose={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "themePackages.details" }); button.focus(); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.install" })).toBeEnabled());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "themePackages.details" })).toHaveFocus());
  });
  it("discards a metadata response after its dialog is disposed", async () => {
    let finish!: (value: typeof snapshot) => void;
    mocks.invoke.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const view = render(<ThemeDiscovery isOpen onClose={vi.fn()} />); view.unmount();
    finish(snapshot); await Promise.resolve();
    expect(screen.queryByText("Fixture theme")).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledOnce();
  });
});
