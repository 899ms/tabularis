import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";
import { invoke } from "@tauri-apps/api/core";
import { PluginsTab } from "../../../src/components/settings/PluginsTab";
import { usePluginRegistry } from "../../../src/hooks/usePluginRegistry";
import { getPluginUpdates } from "../../../src/utils/pluginUpdates";
import { APP_VERSION } from "../../../src/version";
import en from "../../../src/i18n/locales/en.json";
import type { RegistryPluginWithStatus, PluginManifest } from "../../../src/types/plugins";

const i18n = createInstance();
await i18n.init({ lng: "en", resources: { en: { translation: en } } });
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: i18n.t.bind(i18n) }) }));
vi.mock("lucide-react", async () => await vi.importActual("lucide-react"));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../../src/hooks/usePluginRegistry", () => ({ usePluginRegistry: vi.fn() }));
const mocks = vi.hoisted(() => ({
  refreshDrivers: vi.fn(), refreshRegistry: vi.fn(), updateSetting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../src/hooks/useDrivers", () => ({ useDrivers: () => ({
  allDrivers: [builtin, driver],
  installedPlugins: [driver, { id: "redis", name: "Redis", version: "1.0.0", description: "Redis driver" }, { id: "local", name: "Local driver", version: "1.0.0", description: "Not in registry" }],
  refresh: mocks.refreshDrivers,
}) }));
vi.mock("../../../src/hooks/useSettings", () => ({ useSettings: () => ({
  settings: { activeExternalDrivers: ["postgresql"] }, updateSetting: mocks.updateSetting,
}) }));
vi.mock("../../../src/hooks/useDatabase", () => ({ useDatabase: () => ({
  openConnectionIds: [], connectionDataMap: {}, disconnect: vi.fn(), connections: [],
}) }));
vi.mock("../../../src/components/ui/SlotAnchor", () => ({ SlotAnchor: () => null }));
vi.mock("../../../src/components/modals/PluginInstallErrorModal", () => ({ PluginInstallErrorModal: () => null }));
vi.mock("../../../src/components/modals/PluginReadmeModal", () => ({ PluginReadmeModal: () => null }));
vi.mock("../../../src/components/modals/PluginRemoveModal", () => ({ PluginRemoveModal: () => null }));
vi.mock("../../../src/components/modals/PluginStartErrorModal", () => ({ PluginStartErrorModal: () => null }));

const driver: PluginManifest = {
  id: "postgresql", name: "PostgreSQL", version: "2.0.0", description: "PostgreSQL driver", default_port: 5432,
  capabilities: { schemas: true, views: true, routines: true, file_based: false, folder_based: false, identifier_quote: '"', alter_primary_key: true },
};
const builtin: PluginManifest = { ...driver, id: "sqlite", name: "SQLite", is_builtin: true };
const plugin: RegistryPluginWithStatus = {
  id: "postgresql", name: "PostgreSQL", description: "PostgreSQL driver", author: "Tabularis", homepage: "",
  installed_version: "2.0.0", latest_version: "2.0.0", update_available: false, platform_supported: true,
  releases: ["2.0.0", "1.0.0", "0.5.0"].map((version) => ({ version, platform_supported: true, min_tabularis_version: null })),
};
const redis: RegistryPluginWithStatus = { ...plugin, id: "redis", name: "Redis", description: "Redis driver", installed_version: "1.0.0", update_available: true };
const mongo: RegistryPluginWithStatus = { ...plugin, id: "mongodb", name: "MongoDB", description: "MongoDB driver", installed_version: null };

function setRegistry(plugins: RegistryPluginWithStatus[]) {
  vi.mocked(usePluginRegistry).mockReturnValue({ plugins, updates: getPluginUpdates(plugins, APP_VERSION), loading: false, error: null, refresh: mocks.refreshRegistry });
}
function renderTab(filter = "all") {
  return render(<MemoryRouter initialEntries={[`/settings?tab=plugins&filter=${filter}`]}><PluginsTab /></MemoryRouter>);
}
function card(name: string) {
  const element = screen.getByText(name).closest("div.group");
  if (!(element instanceof HTMLElement)) throw new Error(`Missing card: ${name}`);
  return within(element);
}

describe("PluginsTab filters and version controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRegistry([plugin, redis, mongo]);
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_plugin_startup_errors") return [];
      if (command === "install_plugin" || command === "cancel_plugin_install") return;
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it("shows both installed and uninstalled catalogue plugins in All and counts them all", () => {
    renderTab();
    expect(screen.getByRole("button", { name: /^All/ })).toHaveTextContent("3");
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("MongoDB")).toBeInTheDocument();
    expect(card("PostgreSQL").getByText("Installed v2.0.0")).toBeInTheDocument();
    expect(card("MongoDB").getByRole("button", { name: "Install v2.0.0" })).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "PostgreSQL" } });
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("MongoDB")).not.toBeInTheDocument();
  });

  it("keeps Installed limited to installed/built-in plugins, including offline/local entries", () => {
    renderTab("installed");
    expect(screen.getByRole("button", { name: /^Installed/ })).toHaveTextContent("4");
    expect(screen.queryByText("MongoDB")).not.toBeInTheDocument();
    expect(card("SQLite").queryByRole("button", { name: /versions|Update|Downgrade/ })).not.toBeInTheDocument();
    expect(card("Local driver").getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(card("PostgreSQL").getByRole("button", { name: "Older versions" })).toBeInTheDocument();
    expect(card("Redis").getByRole("button", { name: "Update v2.0.0" })).toBeInTheDocument();
  });

  it.each(["all", "installed"])("allows downgrading an up-to-date plugin from %s", async (filter) => {
    renderTab(filter);
    fireEvent.click(card("PostgreSQL").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /^v1.0.0/ }));
    fireEvent.click(card("PostgreSQL").getByRole("button", { name: "Downgrade to v1.0.0" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("install_plugin", { pluginId: "postgresql", version: "1.0.0" }));
    await waitFor(() => expect(mocks.refreshRegistry).toHaveBeenCalled());
    expect(mocks.refreshDrivers).toHaveBeenCalled();
    expect(card("PostgreSQL").getByRole("button", { name: "Older versions" })).toBeInTheDocument();
  });

  it("lets disabled plugins choose a version while retaining enable/settings/remove controls", async () => {
    renderTab("installed");
    expect(card("Redis").getByRole("button", { name: "Enable plugin" })).toBeInTheDocument();
    expect(card("Redis").getByRole("button", { name: "Remove" })).toBeInTheDocument();
    fireEvent.click(card("Redis").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /^v0.5.0/ }));
    expect(card("Redis").getByRole("button", { name: "v0.5.0" })).toBeInTheDocument();
    fireEvent.click(card("Redis").getByRole("button", { name: "Downgrade to v0.5.0" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("install_plugin", { pluginId: "redis", version: "0.5.0" }));
  });

  it("does not offer reinstall when selecting the installed version of an outdated plugin", () => {
    renderTab("installed");
    fireEvent.click(card("Redis").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /v1\.0\.0.*installed/i }));
    expect(card("Redis").queryByRole("button", { name: /Update|Downgrade|Install / })).not.toBeInTheDocument();
    expect(card("Redis").getByText("Installed v1.0.0")).toBeInTheDocument();
  });

  it.each(["all", "installed", "updates"])("uses the same compact update presentation in %s", (filter) => {
    renderTab(filter);
    expect(card("Redis").getByRole("img", { name: "Driver update available" }).textContent).toBe("v2.0.0");
    const root = screen.getByText("Redis").closest("div.group");
    expect(root).toHaveClass("rounded-2xl", "border-strong");
    expect(root?.querySelector(".w-11.h-11")).not.toBeNull();
    expect(root?.querySelector("[class*='animate-']")).toBeNull();
  });

  it("keeps Updates restricted to compatible updates and provides the same version controls", () => {
    renderTab("updates");
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.queryByText("PostgreSQL")).not.toBeInTheDocument();
    expect(screen.queryByText("MongoDB")).not.toBeInTheDocument();
    expect(card("Redis").getByRole("button", { name: "Older versions" })).toBeInTheDocument();
  });

  it("preserves the chosen version when switching from All to Installed", () => {
    renderTab();
    fireEvent.click(card("PostgreSQL").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /^v1.0.0/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Installed/ }));
    expect(card("PostgreSQL").getByRole("button", { name: "Downgrade to v1.0.0" })).toBeEnabled();
  });

  it("blocks incompatible versions but still lets the user choose a supported release", () => {
    setRegistry([{ ...redis, releases: redis.releases.map((release) => release.version === "2.0.0" ? { ...release, min_tabularis_version: "99.0.0" } : release) }]);
    renderTab("installed");
    expect(card("Redis").getByRole("button", { name: "Update v2.0.0" })).toBeDisabled();
    expect(card("Redis").queryByLabelText("Driver update available")).not.toBeInTheDocument();
    fireEvent.click(card("Redis").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /^v0.5.0/ }));
    expect(card("Redis").getByRole("button", { name: "Downgrade to v0.5.0" })).toBeEnabled();
  });

  it("retains cancellation and prevents a second installation from Installed", async () => {
    let finishInstall: (() => void) | undefined;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_plugin_startup_errors") return [];
      if (command === "install_plugin") return new Promise<void>((resolve) => { finishInstall = resolve; });
      if (command === "cancel_plugin_install") return true;
    });
    renderTab("installed");
    fireEvent.click(card("Redis").getByRole("button", { name: "Update v2.0.0" }));
    expect(card("Redis").getByRole("button", { name: "Cancel" })).toBeEnabled();
    fireEvent.click(card("PostgreSQL").getByRole("button", { name: "Older versions" }));
    fireEvent.click(screen.getByRole("option", { name: /^v1.0.0/ }));
    expect(card("PostgreSQL").getByRole("button", { name: "Downgrade to v1.0.0" })).toBeDisabled();
    fireEvent.click(card("Redis").getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("cancel_plugin_install", { pluginId: "redis" }));
    await act(async () => finishInstall?.());
  });
});
