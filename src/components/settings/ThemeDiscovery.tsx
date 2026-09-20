import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { APP_VERSION } from "../../version";
import { useTheme } from "../../hooks/useTheme";
import { ThemeDialog } from "../ui/ThemeDialog";
import { ThemeReadmeModal } from "../modals/ThemeReadmeModal";
import { themeDownloadCount, isCompatibleThemeRelease, type ThemeRegistryPlugin, type ThemeRegistrySnapshot } from "../../utils/themeDiscovery";

interface ThemeDiscoveryProps { isOpen: boolean; onClose: () => void; expectedPackage?: { registryKey: string; packageName: string } }

export function ThemeDiscovery({ isOpen, onClose, expectedPackage }: ThemeDiscoveryProps) {
  const { t, i18n } = useTranslation();
  const { catalog, refreshCatalog } = useTheme();
  const [snapshot, setSnapshot] = useState<ThemeRegistrySnapshot>();
  const [error, setError] = useState("");
  const [scopeError, setScopeError] = useState<"registryMismatch" | "noThemes">();
  const [selected, setSelected] = useState<ThemeRegistryPlugin>();
  const [query, setQuery] = useState("");
  const detailsButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnToPackage = useRef<string | undefined>(undefined);
  const expectedKey = expectedPackage?.registryKey;
  const expectedName = expectedPackage?.packageName;
  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    const request = expectedName ? invoke<ThemeRegistrySnapshot>("fetch_theme_registry", { packageName: expectedName, expectedRegistryKey: expectedKey }) : invoke<ThemeRegistrySnapshot>("fetch_theme_registry");
    void request.then((value) => {
      if (disposed) return;
      if (expectedKey && value.registryKey !== expectedKey) { setScopeError("registryMismatch"); return; }
      setSnapshot(value);
      if (expectedName) {
        const plugin = value.plugins.find((item) => item.id === expectedName);
        if (plugin) setSelected(plugin); else setScopeError("noThemes");
      }
    }).catch((failure) => { if (!disposed) { if (String(failure).includes("Configured theme registry changed")) setScopeError("registryMismatch"); else setError(String(failure)); } });
    return () => { disposed = true; };
  }, [isOpen, expectedKey, expectedName]);
  useEffect(() => {
    if (!selected && returnToPackage.current) { detailsButtons.current.get(returnToPackage.current)?.focus(); returnToPackage.current = undefined; }
  }, [selected]);
  if (!isOpen) return null;
  if (selected && snapshot) return <ThemeRegistryInstall key={selected.id} isOpen onClose={expectedPackage ? onClose : () => setSelected(undefined)} snapshot={snapshot} plugin={selected} onCommitted={async () => { await refreshCatalog(); }} />;
  return <ThemeDialog isOpen onClose={onClose} title={t("themePackages.discover")}>
    <p className="text-sm text-secondary">{t("themePackages.installHint")}</p>
    {snapshot && <p className="text-xs text-muted break-all">{snapshot.registryUrl}</p>}
    <label className="block">{t("themePackages.search")}<input value={query} onChange={(event) => setQuery(event.target.value)} className="block w-full p-2 bg-base border border-strong rounded-lg" /></label>
    {(error || scopeError) && <p role="alert">{scopeError ? t(`themePackages.${scopeError}`) : error}</p>}
    {!snapshot && !error && !scopeError && <p role="status">{t("themePackages.loading")}</p>}
    {snapshot?.plugins.length === 0 && <p>{t("themePackages.noThemes")}</p>}
    <ul className="space-y-3">{snapshot?.plugins.filter((plugin) => `${plugin.name} ${plugin.description} ${plugin.author}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((plugin) => {
      const downloads = themeDownloadCount(plugin.downloads, i18n.resolvedLanguage ?? i18n.language);
      const installed = catalog.themes.find(({ entry }) => entry.origin.kind === "installed" && entry.origin.identity.registryKey === snapshot.registryKey && entry.origin.identity.packageName === plugin.id);
      return <li key={plugin.id} className="border border-default rounded-lg p-3 space-y-2">
        <h3 className="font-semibold">{plugin.name} <span className="text-xs">{plugin.latest_version}</span></h3>
        <p className="text-sm">{plugin.description}</p><p className="text-xs text-muted">{plugin.author}</p>
        <p aria-label={downloads ? t("themePackages.downloads", { count: downloads.exact }) : undefined} title={downloads?.exact} className="text-xs">{downloads ? t("themePackages.downloads", { count: downloads.compact }) : t("themePackages.downloadsUnavailable")}</p>
        {installed?.entry.origin.kind === "installed" && <p className="text-xs">{t("themePackages.installedVersion", { version: installed.entry.origin.packageVersion })}</p>}
        <button ref={(button) => { if (button) detailsButtons.current.set(plugin.id, button); else detailsButtons.current.delete(plugin.id); }} type="button" onClick={() => { returnToPackage.current = plugin.id; setSelected(plugin); }} className="px-3 py-2 border border-strong rounded-lg">{t("themePackages.details")}</button>
      </li>;
    })}</ul>
  </ThemeDialog>;
}

interface ThemeRegistryInstallProps extends Pick<ThemeDiscoveryProps, "isOpen" | "onClose"> {
  snapshot: ThemeRegistrySnapshot;
  plugin: ThemeRegistryPlugin;
  onCommitted: () => Promise<void>;
  initialVersion?: string;
  requestedRegistry?: string | null;
}

export function ThemeRegistryInstall({ isOpen, onClose, snapshot, plugin, onCommitted, initialVersion = "", requestedRegistry = null }: ThemeRegistryInstallProps) {
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState<ThemeRegistryPlugin>();
  const [version, setVersion] = useState(initialVersion);
  const [readme, setReadme] = useState(false);
  const readmeButton = useRef<HTMLButtonElement>(null);
  const returningFromReadme = useRef(false);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    void invoke<ThemeRegistryPlugin>("fetch_theme_package_detail", { packageName: plugin.id, expectedRegistryKey: snapshot.registryKey, requestedRegistryUrl: requestedRegistry }).then((value) => { if (!disposed) setDetail(value); }).catch((failure) => { if (!disposed) setError(String(failure)); });
    return () => { disposed = true; };
  }, [plugin.id, snapshot.registryKey, requestedRegistry, isOpen]);
  useEffect(() => {
    if (isOpen && !readme && returningFromReadme.current) { readmeButton.current?.focus(); returningFromReadme.current = false; }
  }, [isOpen, readme]);
  if (!isOpen) return null;
  if (readme) return <ThemeReadmeModal key={`${plugin.id}:${i18n.resolvedLanguage ?? i18n.language}`} plugin={detail ?? plugin} registryUrl={snapshot.registryUrl} onClose={() => setReadme(false)} />;
  const release = detail?.releases.find((candidate) => candidate.version === (version || detail.latest_version));
  const compatible = release && isCompatibleThemeRelease(release, APP_VERSION);
  const downloads = themeDownloadCount(detail?.downloads ?? plugin.downloads, i18n.resolvedLanguage ?? i18n.language);
  const install = async () => {
    setBusy(true); setError("");
    try {
      const result = await invoke<{ warnings: string[] }>("install_registry_theme", { packageName: plugin.id, expectedRegistryKey: snapshot.registryKey, version: version || null });
      setCommitted(true);
      setError(result.warnings.join("\n"));
      try { await onCommitted(); }
      catch (failure) { setError(`${t("themePackages.committedRefreshFailed")} ${String(failure)}`); }
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  return <>
    <ThemeDialog isOpen onClose={onClose} busy={busy} title={plugin.name}>
      <p>{plugin.description}</p><p className="text-sm text-muted">{plugin.author}</p>
      <p className="text-xs break-all">{snapshot.registryUrl}</p>
      <p title={downloads?.exact} aria-label={downloads ? t("themePackages.downloads", { count: downloads.exact }) : undefined}>{downloads ? t("themePackages.downloads", { count: downloads.compact }) : t("themePackages.downloadsUnavailable")}</p>
      <p className="text-sm">{t("themePackages.installHint")}</p>
      <button ref={readmeButton} type="button" disabled={busy} onClick={() => { returningFromReadme.current = true; setReadme(true); }} className="px-3 py-2 border rounded-lg">{t("themePackages.readme")}</button>
      <label className="block">{t("themePackages.version")}<select value={version} disabled={busy || committed} onChange={(event) => setVersion(event.target.value)} className="block bg-base border rounded-lg p-2">
        <option value="">{t("themePackages.latest")}</option>
        {detail?.releases.map((candidate) => <option key={candidate.version} value={candidate.version}>{candidate.version}</option>)}
      </select></label>
      {release?.min_tabularis_version && <p>{t("themePackages.minimumVersion", { version: release.min_tabularis_version })}</p>}
      {detail && !compatible && <p role="status">{t("themePackages.incompatible")}</p>}
      {!detail && !error && <p role="status">{t("themePackages.loading")}</p>}
      {error && <p role="alert" className="text-red-400 whitespace-pre-wrap">{error}</p>}
      {committed && <p role="status">{t("themePackages.installedHint")}</p>}
      <div className="flex justify-end gap-3">
        {busy ? <button type="button" onClick={() => { void invoke("cancel_theme_install", { registryKey: snapshot.registryKey, packageName: plugin.id }).catch((failure) => setError(String(failure))); }}>{t("common.cancel")}</button> : <button type="button" onClick={onClose}>{t("common.close")}</button>}
        <button type="button" disabled={!compatible || busy || committed} onClick={() => void install()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{t("themePackages.install")}</button>
      </div>
    </ThemeDialog>
  </>;
}
