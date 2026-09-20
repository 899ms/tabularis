import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ThemeDialog } from "../ui/ThemeDialog";
import { ThemeSqlSample } from "../ui/ThemeSqlSample";
import { useTheme } from "../../hooks/useTheme";
import { convertVsCodeTheme, VsCodeThemeImportError, type VsCodeThemeDiagnostic } from "../../utils/vsCodeThemeImport";
import { resolveCatalogEntry } from "../../utils/themeCatalog";
import type { CatalogTheme, NativeThemeContribution } from "../../types/themeCatalog";
import type { ThemePackageMode } from "../../types/themePackage";

interface ThemeDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind: "tabularis" | "vscode" | "edit";
  original?: CatalogTheme;
}

export function ThemeDocumentModal({ isOpen, onClose, kind, original }: ThemeDocumentModalProps) {
  const { t } = useTranslation();
  const themes = useTheme();
  const [source, setSource] = useState(original?.entry.source ?? "");
  const [editorSource, setEditorSource] = useState(original?.entry.editor ? JSON.stringify(original.entry.editor, null, 2) : "");
  const snapshot = kind === "edit" && original?.entry.format === "legacy" && !!original.entry.editor;
  const [name, setName] = useState(original?.entry.name ?? t("themePackages.importedTheme"));
  const [mode, setMode] = useState<ThemePackageMode | "">("");
  const [prepared, setPrepared] = useState<{ entry: NativeThemeContribution; document: string; diagnostics: VsCodeThemeDiagnostic[] }>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [apply, setApply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const { cancelPreview } = themes;
  useEffect(() => () => { ++generation.current; cancelPreview(); }, [cancelPreview]);
  if (!isOpen) return null;

  const invalidate = () => { ++generation.current; setPrepared(undefined); setAcknowledged(false); setError(""); cancelPreview(); };
  const preview = async () => {
    const request = ++generation.current;
    setBusy(true); setError(""); setPrepared(undefined); setAcknowledged(false); cancelPreview();
    try {
      const converted = kind === "vscode" ? convertVsCodeTheme(source, { mode: mode || undefined }) : undefined;
      const document = snapshot ? JSON.stringify({ themeSnapshotVersion: 1, source, editor: JSON.parse(editorSource) }) : converted ? JSON.stringify(converted.definition) : source;
      const entry = await invoke<NativeThemeContribution>("preview_theme_document", { source: document, name });
      if (request !== generation.current) return;
      themes.previewTheme(entry);
      setPrepared({ entry, document, diagnostics: converted?.diagnostics ?? [] });
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof VsCodeThemeImportError ? t(`themePackages.importErrors.${failure.code}`) : String(failure));
    } finally { if (request === generation.current) setBusy(false); }
  };
  const commit = async () => {
    if (!prepared || committed || (prepared.diagnostics.length > 0 && !acknowledged)) return;
    setBusy(true); setError("");
    try {
      let id: string;
      if (original) {
        id = original.entry.id;
        if (snapshot) await themes.updatePersonalSource(id, name, prepared.entry.source, original.entry.revision, prepared.entry.editor ?? undefined);
        else if (original.entry.format === "v1") await themes.updatePersonalSource(id, name, prepared.entry.source, original.entry.revision);
        else {
          const edited = resolveCatalogEntry(prepared.entry).resolved.theme;
          await themes.updateCustomTheme({ ...edited, id, name });
        }
      } else id = (await themes.importTheme(prepared.document, name)).id;
      // Do not retry creation if subsequent selection persistence fails.
      setCommitted(true);
      cancelPreview();
      if (apply) {
        try { await themes.setTheme(id); }
        catch (failure) { setError(`${t("themePackages.savedNotApplied")} ${String(failure)}`); return; }
      }
      onClose();
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  return <ThemeDialog isOpen onClose={onClose} busy={busy} title={t(`themePackages.${kind === "vscode" ? "importVSCode" : kind === "edit" ? "edit" : "importJSON"}`)}>
    <p className="text-sm text-secondary">{t("themePackages.previewHint")}</p>
    {kind === "vscode" && <p className="text-sm text-secondary">{t("themePackages.licenseNotice")}</p>}
    <fieldset disabled={busy || committed} className="space-y-3">
      {kind !== "edit" && <label className="block text-sm">{t("themePackages.file")}<input type="file" accept={kind === "vscode" ? ".json,.jsonc" : ".json"} className="block w-full" onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        invalidate(); const request = generation.current;
        const limit = kind === "vscode" ? 256 * 1024 : 8 * 1024 * 1024;
        if (file.size > limit) { setError(t("themePackages.fileTooLarge")); return; }
        try { const text = await file.text(); if (request === generation.current) setSource(text); }
        catch (failure) { if (request === generation.current) setError(String(failure)); }
      }} /></label>}
      <label className="block text-sm">{t("themePackages.name")}<input value={name} maxLength={128} onChange={(event) => { invalidate(); setName(event.target.value); }} className="block w-full px-3 py-2 bg-base border border-strong rounded-lg" /></label>
      {kind === "vscode" && <label className="block text-sm">{t("themePackages.mode")}<select value={mode} onChange={(event) => { invalidate(); setMode(event.target.value as ThemePackageMode | ""); }} className="block bg-base border border-strong rounded-lg p-2">
        <option value="">{t("themePackages.detectMode")}</option>
        {(["light", "dark", "high-contrast"] as const).map((value) => <option key={value} value={value}>{t(`themePackages.modes.${value}`)}</option>)}
      </select></label>}
      <label className="block text-sm">{t("themePackages.source")}<textarea spellCheck={false} value={source} maxLength={8 * 1024 * 1024} onChange={(event) => { invalidate(); setSource(event.target.value); }} rows={12} className="block w-full font-mono text-xs p-3 bg-base border border-strong rounded-lg" /></label>
      {snapshot && <label className="block text-sm">{t("themePackages.snapshotEditor")}<textarea aria-label={t("themePackages.snapshotEditor")} spellCheck={false} value={editorSource} onChange={(event) => { invalidate(); setEditorSource(event.target.value); }} maxLength={4 * 1024 * 1024} rows={10} className="block w-full font-mono text-xs p-3 bg-base border border-strong rounded-lg" /><span className="text-muted">{t("themePackages.snapshotEditorHelp")}</span></label>}
      <button type="button" onClick={() => void preview()} disabled={!source || !name.trim()} className="px-4 py-2 border border-strong rounded-lg disabled:opacity-50">{t("themePackages.preview")}</button>
      {prepared && <div role="status" className="text-sm text-secondary">{t("themePackages.previewReady")}</div>}
      {!!prepared?.diagnostics.length && <div className="space-y-2">
        <ul className="text-xs max-h-40 overflow-y-auto">{prepared.diagnostics.map((diagnostic, index) => <li key={index}>{t(`themePackages.diagnostics.${diagnostic.code}`)}: <code>{diagnostic.path}</code></li>)}</ul>
        <label className="flex gap-2"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{t("themePackages.acknowledge")}</label>
      </div>}
      <label className="flex gap-2"><input type="checkbox" checked={apply} onChange={(event) => setApply(event.target.checked)} />{t("themePackages.applyAfterSave")}</label>
    </fieldset>
    {prepared && !committed && <ThemeSqlSample contribution={prepared.entry} />}
    {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    <div className="flex justify-end gap-3">
      <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2">{t(committed ? "common.close" : "common.cancel")}</button>
      <button type="button" disabled={busy || committed || !prepared || (prepared.diagnostics.length > 0 && !acknowledged)} onClick={() => void commit()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{t("common.save")}</button>
    </div>
  </ThemeDialog>;
}
