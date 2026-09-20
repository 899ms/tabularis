import { useState } from "react";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { CatalogTheme } from "../../types/themeCatalog";
import { exportThemePackage } from "../../utils/themePackageExport";
import { ThemeDialog } from "../ui/ThemeDialog";

interface ThemePackageExportModalProps { isOpen: boolean; onClose: () => void; theme: CatalogTheme }

export function ThemePackageExportModal({ isOpen, onClose, theme }: ThemePackageExportModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [minimum, setMinimum] = useState("");
  const [license, setLicense] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!isOpen) return null;
  const exportArchive = async () => {
    setBusy(true); setError("");
    try {
      const bytes = exportThemePackage(theme, { kind: "theme", name, version, min_runtime_version: minimum, theme_schema_version: 1, theme_variants: [{ id: "main", name: theme.entry.name, file: "themes/main.json" }] }, license);
      const path = await save({ defaultPath: `${name}-${version}-universal.zip`, filters: [{ name: "ZIP", extensions: ["zip"] }] });
      if (path) { await writeFile(path, bytes); onClose(); }
    } catch (failure) { setError(`${t("themePackages.exportError")} ${String(failure)}`); }
    finally { setBusy(false); }
  };
  return <ThemeDialog isOpen onClose={onClose} busy={busy} title={t("themePackages.exportPackage")}>
    <p className="text-sm">{t("themePackages.licenseNotice")}</p>
    <p className="text-sm">{t("themePackages.runtimeWarning")}</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">{t("themePackages.packageName")}<input autoFocus value={name} maxLength={64} onChange={(event) => setName(event.target.value)} className="block w-full bg-base border rounded-lg p-2" /></label>
      <label className="block">{t("themePackages.version")}<input value={version} onChange={(event) => setVersion(event.target.value)} className="block w-full bg-base border rounded-lg p-2" /></label>
      <label className="block">{t("themePackages.minimumRuntime")}<input value={minimum} onChange={(event) => setMinimum(event.target.value)} className="block w-full bg-base border rounded-lg p-2" /></label>
      <label className="block">{t("themePackages.license")}<textarea value={license} maxLength={256 * 1024} rows={4} onChange={(event) => setLicense(event.target.value)} className="block w-full bg-base border rounded-lg p-2" /></label>
      <label className="flex gap-2"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />{t("themePackages.rightsAcknowledged")}</label>
    </fieldset>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button><button type="button" disabled={busy || !name || !minimum || !license || !rights} onClick={() => void exportArchive()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{t("themePackages.exportPackage")}</button></div>
  </ThemeDialog>;
}
