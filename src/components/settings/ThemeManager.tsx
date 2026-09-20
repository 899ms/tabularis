import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useTheme } from "../../hooks/useTheme";
import { useSettings } from "../../hooks/useSettings";
import type { CatalogTheme } from "../../types/themeCatalog";
import { ThemeDialog } from "../ui/ThemeDialog";
import { ThemeSqlSample } from "../ui/ThemeSqlSample";
import { ThemeDocumentModal } from "../modals/ThemeDocumentModal";
import { LocalThemePackageModal } from "../modals/LocalThemePackageModal";
import { ThemePackageExportModal } from "../modals/ThemePackageExportModal";
import { ThemeRecoveryModal } from "../modals/ThemeRecoveryModal";
import { ThemeDiscovery } from "./ThemeDiscovery";

type ThemeAction = { kind: "preview" | "duplicate" | "delete"; theme: CatalogTheme }
  | { kind: "package"; theme: CatalogTheme; operation: "disable" | "enable" | "remove" };

export function ThemeManager() {
  const { t } = useTranslation();
  const themes = useTheme();
  const { settings } = useSettings();
  const [document, setDocument] = useState<{ kind: "tabularis" | "vscode" | "edit"; original?: CatalogTheme }>();
  const [action, setAction] = useState<ThemeAction>();
  const [discover, setDiscover] = useState<true | { registryKey: string; packageName: string }>();
  const [local, setLocal] = useState(false);
  const [recover, setRecover] = useState(false);
  const [exporting, setExporting] = useState<CatalogTheme>();
  const [error, setError] = useState("");
  const savedIds = [themes.settings.activeThemeId, themes.settings.lightThemeId, themes.settings.darkThemeId, settings.editorTheme].filter((id): id is string => !!id);
  const missing = [...new Set(savedIds.filter((id) => !themes.catalog.themes.some(({ entry }) => entry.id === id && entry.available)))];
  const exportJSON = async (theme: CatalogTheme) => {
    try {
      const source = await themes.exportTheme(theme.entry.id);
      const path = await save({ defaultPath: "theme.json", filters: [{ name: "JSON", extensions: ["json"] }] });
      if (path) await writeTextFile(path, source);
    } catch (failure) { setError(String(failure)); }
  };
  return <section aria-labelledby="theme-management-title" className="space-y-4 mb-6">
    <h2 id="theme-management-title" className="text-lg font-semibold">{t("themePackages.manage")}</h2>
    <p className="text-sm text-secondary">{t("themePackages.previewHint")}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={themes.isLoading} onClick={() => setDocument({ kind: "tabularis" })} className="px-3 py-2 border rounded-lg">{t("themePackages.importJSON")}</button>
      <button type="button" disabled={themes.isLoading} onClick={() => setDocument({ kind: "vscode" })} className="px-3 py-2 border rounded-lg">{t("themePackages.importVSCode")}</button>
      <button type="button" onClick={() => setLocal(true)} className="px-3 py-2 border rounded-lg">{t("themePackages.localPackage")}</button>
      <button type="button" onClick={() => setDiscover(true)} className="px-3 py-2 border rounded-lg">{t("themePackages.discover")}</button>
      <button type="button" onClick={() => setRecover(true)} className="px-3 py-2 border rounded-lg">{t("themePackages.recover")}</button>
      <button type="button" onClick={() => { void themes.refreshCatalog().catch((failure) => setError(String(failure))); }} className="px-3 py-2 border rounded-lg">{t("themePackages.refresh")}</button>
    </div>
    {themes.isLoading && <p role="status">{t("themePackages.loading")}</p>}
    {missing.map((id) => <p key={id} role="status" className="text-sm text-yellow-400 break-all">{t("themePackages.missing", { id })}</p>)}
    {themes.catalog.issues.length > 0 && <details className="text-sm"><summary>{t("themePackages.catalogIssues")}</summary><ul>{themes.catalog.issues.map((issue, index) => <li key={index}>{issue.location}: {issue.message}</li>)}</ul></details>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {(["builtin", "installed", "personal"] as const).map((kind) => <section key={kind} aria-label={t(`themePackages.groups.${kind}`)} className="space-y-2">
      <h3 className="font-semibold">{t(`themePackages.groups.${kind}`)}</h3>
      <ul className="space-y-2">{themes.catalog.themes.filter(({ entry }) => entry.origin.kind === kind).map((theme, index, group) => {
        const { entry } = theme;
        const origin = entry.origin;
        const attribution = theme.resolved.source.kind === "v1" ? theme.resolved.source.value.attribution : theme.resolved.theme.author;
        const firstPackageVariant = origin.kind === "installed" && group.findIndex((item) => item.entry.origin.kind === "installed" && item.entry.origin.identity.registryKey === origin.identity.registryKey && item.entry.origin.identity.packageName === origin.identity.packageName) === index;
        return <li key={entry.id} className="p-3 border border-default rounded-lg space-y-2">
          <div className="flex items-center gap-2"><span aria-hidden className="inline-block w-5 h-5 rounded-full border" style={{ backgroundColor: theme.resolved.theme.colors.accent.primary }} /><h4>{entry.name}</h4><span className="text-xs text-muted">{t(`themePackages.modes.${entry.mode}`)}</span></div>
          {origin.kind === "installed" && <p className="text-xs text-muted break-all">{origin.identity.packageName} · {origin.packageVersion} · {origin.identity.registryKey}</p>}
          {attribution && <p className="text-xs text-muted">{attribution}</p>}
          {!entry.available && <p className="text-xs">{t("themePackages.disabled")}</p>}
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" disabled={!entry.available || themes.isLoading} onClick={() => { themes.previewTheme(entry.id); setAction({ kind: "preview", theme }); }}>{t("themePackages.preview")}</button>
            <button type="button" disabled={!entry.available || themes.isLoading} onClick={() => setAction({ kind: "duplicate", theme })}>{t("themePackages.duplicate")}</button>
            <button type="button" onClick={() => void exportJSON(theme)}>{t("themePackages.exportJSON")}</button>
            <button type="button" onClick={() => setExporting(theme)}>{t("themePackages.exportPackage")}</button>
            {kind === "personal" && <><button type="button" disabled={themes.isLoading} onClick={() => setDocument({ kind: "edit", original: theme })}>{t("themePackages.edit")}</button><button type="button" disabled={themes.isLoading} onClick={() => setAction({ kind: "delete", theme })}>{t("themePackages.remove")}</button></>}
            {firstPackageVariant && <>
              <button type="button" onClick={() => { if (origin.kind === "installed") setDiscover({ registryKey: origin.identity.registryKey, packageName: origin.identity.packageName }); }}>{t("themePackages.update")}</button>
              <button type="button" onClick={() => setAction({ kind: "package", theme, operation: entry.available ? "disable" : "enable" })}>{t(`themePackages.${entry.available ? "disable" : "enable"}`)}</button>
              <button type="button" onClick={() => setAction({ kind: "package", theme, operation: "remove" })}>{t("themePackages.removePackage")}</button>
            </>}
          </div>
        </li>;
      })}</ul>
    </section>)}
    {document && <ThemeDocumentModal isOpen onClose={() => setDocument(undefined)} {...document} />}
    {action && <ThemeActionDialog key={`${action.kind}:${action.theme.entry.id}`} isOpen action={action} onClose={() => { themes.cancelPreview(); setAction(undefined); }} />}
    {discover && <ThemeDiscovery key={discover === true ? "all" : `${discover.registryKey}:${discover.packageName}`} isOpen onClose={() => setDiscover(undefined)} expectedPackage={discover === true ? undefined : discover} />}
    {recover && <ThemeRecoveryModal isOpen onClose={() => setRecover(false)} />}
    {local && <LocalThemePackageModal isOpen onClose={() => setLocal(false)} />}
    {exporting && <ThemePackageExportModal isOpen onClose={() => setExporting(undefined)} theme={exporting} />}
  </section>;
}

function ThemeActionDialog({ isOpen, action, onClose }: { isOpen: boolean; action: ThemeAction; onClose: () => void }) {
  const { t } = useTranslation();
  const themes = useTheme();
  const [name, setName] = useState(action.theme.entry.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [committed, setCommitted] = useState(false);
  const { cancelPreview } = themes;
  useEffect(() => cancelPreview, [cancelPreview]);
  const execute = async () => {
    setBusy(true); setError("");
    try {
      if (action.kind === "preview") await themes.setTheme(action.theme.entry.id);
      else if (action.kind === "duplicate") await themes.duplicateTheme(action.theme.entry.id, name);
      else if (action.kind === "delete") await themes.deleteCustomTheme(action.theme.entry.id);
      else if (action.kind === "package" && action.theme.entry.origin.kind === "installed") {
        const identity = action.theme.entry.origin.identity;
        const args = { registryKey: identity.registryKey, packageName: identity.packageName };
        if (action.operation === "remove") await invoke("uninstall_theme_package", args);
        else await invoke("set_theme_package_enabled", { ...args, enabled: action.operation === "enable" });
        setCommitted(true);
        try { await themes.refreshCatalog(); }
        catch (failure) { setError(`${t("themePackages.committedRefreshFailed")} ${String(failure)}`); return; }
      }
      setCommitted(true); onClose();
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  return <ThemeDialog isOpen={isOpen} onClose={onClose} busy={busy} title={action.theme.entry.name}>
    <p>{t(action.kind === "preview" ? "themePackages.previewReady" : action.kind === "package" ? "themePackages.packageWarning" : action.kind === "delete" ? "themePackages.deleteWarning" : "themePackages.duplicateHint")}</p>
    {action.kind === "preview" && <ThemeSqlSample contribution={action.theme.entry} />}
    {action.kind === "duplicate" && <label className="block">{t("themePackages.name")}<input autoFocus value={name} maxLength={128} disabled={busy} onChange={(event) => setName(event.target.value)} className="block w-full bg-base border rounded-lg p-2" /></label>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} disabled={busy}>{t(committed ? "common.close" : "common.cancel")}</button>
      <button type="button" disabled={busy || committed || !name.trim()} onClick={() => void execute()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{t(action.kind === "preview" ? "themePackages.apply" : "themePackages.confirm")}</button>
    </div>
  </ThemeDialog>;
}
