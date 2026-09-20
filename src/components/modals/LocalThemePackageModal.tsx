import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTheme } from "../../hooks/useTheme";
import type { NativeThemeContribution } from "../../types/themeCatalog";
import type { ThemePackageManifestV1 } from "../../types/themePackage";
import { ThemeDialog } from "../ui/ThemeDialog";
import { ThemeSqlSample } from "../ui/ThemeSqlSample";

interface LocalThemePreview { digest: string; manifest: ThemePackageManifestV1; variants: NativeThemeContribution[] }
interface LocalThemePackageModalProps { isOpen: boolean; onClose: () => void }

export function LocalThemePackageModal({ isOpen, onClose }: LocalThemePackageModalProps) {
  const { t } = useTranslation();
  const { previewTheme, cancelPreview, refreshCatalog } = useTheme();
  const [preview, setPreview] = useState<LocalThemePreview>();
  const [path, setPath] = useState("");
  const [selected, setSelected] = useState<NativeThemeContribution>();
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => cancelPreview, [cancelPreview]);
  if (!isOpen) return null;
  const choose = async () => {
    setBusy(true); setError(""); setPreview(undefined); setSelected(undefined); cancelPreview();
    try {
      const selected = await open({ multiple: false, directory: false, filters: [{ name: "ZIP", extensions: ["zip"] }] });
      if (typeof selected !== "string") return;
      const result = await invoke<LocalThemePreview>("preview_local_theme_package", { path: selected });
      setPath(selected); setPreview(result);
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  const install = async () => {
    if (!preview) return;
    setBusy(true); setInstalling(true); setError("");
    try {
      const result = await invoke<{ warnings: string[] }>("install_local_theme_package", { path, packageName: preview.manifest.name, expectedDigest: preview.digest });
      setCommitted(true); cancelPreview(); setError(result.warnings.join("\n"));
      try { await refreshCatalog(); }
      catch (failure) { setError(`${t("themePackages.committedRefreshFailed")} ${String(failure)}`); }
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); setInstalling(false); }
  };
  const origin = preview?.variants[0]?.origin;
  return <ThemeDialog isOpen onClose={onClose} busy={busy} title={t("themePackages.localPackage")}>
    <p className="text-sm">{t("themePackages.installHint")}</p>
    <button type="button" disabled={busy || committed} onClick={() => void choose()} className="px-3 py-2 border rounded-lg">{t("themePackages.chooseArchive")}</button>
    {preview && <>
      <h3>{preview.manifest.name} · {preview.manifest.version}</h3>
      <p className="text-xs break-all">{path}</p>
      <ul className="space-y-2">{preview.variants.map((variant) => <li key={variant.id}><button type="button" disabled={busy || committed} onClick={() => { previewTheme(variant); setSelected(variant); }} className="px-3 py-2 border rounded-lg">{variant.name} · {t(`themePackages.modes.${variant.mode}`)} · {t("themePackages.preview")}</button></li>)}</ul>
    </>}
    {selected && !committed && <ThemeSqlSample contribution={selected} />}
    {error && <p role="alert" className="text-red-400 whitespace-pre-wrap">{error}</p>}
    {committed && <p role="status">{t("themePackages.installedHint")}</p>}
    <div className="flex justify-end gap-3">
      {installing && origin?.kind === "installed" ? <button type="button" onClick={() => { void invoke("cancel_theme_install", { registryKey: origin.identity.registryKey, packageName: origin.identity.packageName }).catch((failure) => setError(String(failure))); }}>{t("common.cancel")}</button> : <button type="button" disabled={busy} onClick={onClose}>{t("common.close")}</button>}
      <button type="button" disabled={busy || committed || !preview} onClick={() => void install()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{t("themePackages.install")}</button>
    </div>
  </ThemeDialog>;
}
