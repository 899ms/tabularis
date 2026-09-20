import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeManager } from "../../../src/components/settings/ThemeManager";
import { builtinCatalog, resolveCatalogEntry } from "../../../src/utils/themeCatalog";
import type { ThemeContextType } from "../../../src/contexts/ThemeContext";
import { DEFAULT_THEME_SETTINGS } from "../../../src/types/theme";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
let context: ThemeContextType;
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("../../../src/hooks/useTheme", () => ({ useTheme: () => context }));
vi.mock("../../../src/hooks/useSettings", () => ({ useSettings: () => ({ settings: { editorTheme: "missing-editor" } }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, args?: { id?: string }) => args?.id ? `${key}: ${args.id}` : key, i18n: { language: "en" } }) }));
vi.mock("../../../src/components/ui/ThemeSqlSample", () => ({ ThemeSqlSample: () => <div>SQL sample</div> }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.invoke.mockResolvedValue({ warnings: [] });
  const catalog = builtinCatalog();
  for (const variantId of ["dark", "light"] as const) catalog.themes.push(resolveCatalogEntry({ id: `theme:${"a".repeat(64)}:fixture-theme:${variantId}`, name: `Fixture ${variantId}`, mode: variantId, format: "v1", source: JSON.stringify({ schemaVersion: 1, mode: variantId }), revision: "1", readOnly: true, available: true, origin: { kind: "installed", identity: { registryKey: "a".repeat(64), packageName: "fixture-theme", variantId }, packageVersion: "1.0.0" } }));
  const theme = catalog.themes[0].resolved.theme;
  context = { catalog, currentTheme: theme, allThemes: catalog.themes.map((entry) => entry.resolved.theme), settings: DEFAULT_THEME_SETTINGS, selection: { theme, requestedId: theme.id, previewing: false }, isLoading: false,
    refreshCatalog: vi.fn().mockResolvedValue(catalog), previewTheme: vi.fn(), previewDefinition: vi.fn(), cancelPreview: vi.fn(), updatePersonalSource: vi.fn(), setTheme: vi.fn().mockResolvedValue(undefined), createCustomTheme: vi.fn(), updateCustomTheme: vi.fn(), deleteCustomTheme: vi.fn(), duplicateTheme: vi.fn().mockResolvedValue(theme), importTheme: vi.fn(), exportTheme: vi.fn().mockResolvedValue("{}"), updateSettings: vi.fn() };
});

describe("ThemeManager", () => {
  it("groups origins, exposes missing editor choices and manages packages rather than variants", () => {
    render(<ThemeManager />);
    expect(screen.getByRole("region", { name: "themePackages.groups.builtin" })).toBeInTheDocument();
    const installed = screen.getByRole("region", { name: "themePackages.groups.installed" });
    expect(within(installed).getAllByRole("button", { name: "themePackages.preview" })).toHaveLength(2);
    expect(within(installed).getAllByRole("button", { name: "themePackages.disable" })).toHaveLength(1);
    expect(within(installed).queryByRole("button", { name: "themePackages.edit" })).not.toBeInTheDocument();
    expect(screen.getByText("themePackages.missing: missing-editor")).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("previews without saving and restores on cancel", async () => {
    render(<ThemeManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "themePackages.preview" })[0]);
    expect(context.previewTheme).toHaveBeenCalledWith("tabularis-dark"); expect(context.setTheme).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(context.cancelPreview).toHaveBeenCalled(); expect(context.updateSettings).not.toHaveBeenCalled();
  });
  it("applies once only after explicit confirmation", async () => {
    render(<ThemeManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "themePackages.preview" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "themePackages.apply" }));
    await waitFor(() => expect(context.setTheme).toHaveBeenCalledExactlyOnceWith("tabularis-dark"));
  });
  it("disables the entire native package while retaining selection preferences", async () => {
    render(<ThemeManager />);
    fireEvent.click(screen.getByRole("button", { name: "themePackages.disable" }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "themePackages.confirm" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("set_theme_package_enabled", { registryKey: "a".repeat(64), packageName: "fixture-theme", enabled: false }));
    expect(context.deleteCustomTheme).not.toHaveBeenCalled(); expect(context.setTheme).not.toHaveBeenCalled(); expect(context.updateSettings).not.toHaveBeenCalled();
  });
  it("creates a native personal duplicate without selecting it", async () => {
    render(<ThemeManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "themePackages.duplicate" })[0]);
    fireEvent.change(screen.getByLabelText("themePackages.name"), { target: { value: "My theme" } });
    fireEvent.click(screen.getByRole("button", { name: "themePackages.confirm" }));
    await waitFor(() => expect(context.duplicateTheme).toHaveBeenCalledWith("tabularis-dark", "My theme"));
    expect(context.setTheme).not.toHaveBeenCalled();
  });
});
