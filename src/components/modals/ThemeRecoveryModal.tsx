import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { ThemeDialog } from "../ui/ThemeDialog";

interface Props { isOpen: boolean; onClose: () => void }

export const ThemeRecoveryModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const { refreshCatalog } = useTheme();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const recover = async () => {
    setBusy(true); setNotes([]);
    try {
      const failures = await invoke<string[]>("recover_theme_packages");
      setChecked(true); setNotes(failures);
      try { await refreshCatalog(); }
      catch (error) { setNotes((previous) => [...previous, `${t("themePackages.refreshFailed")}: ${String(error)}`]); }
    } catch (error) { setNotes([String(error)]); }
    finally { setBusy(false); }
  };
  return <ThemeDialog isOpen={isOpen} onClose={onClose} title={t("themePackages.recover")} busy={busy}>
    <p>{t("themePackages.recoveryExplanation")}</p>
    {checked && <p role="status" className="mt-3">{t("themePackages.recoveryDone")}</p>}
    {notes.length > 0 && <ul role="alert" className="text-yellow-400 text-sm mt-3 break-words">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
    <div className="flex justify-end gap-3 mt-5">
      <button type="button" disabled={busy} onClick={onClose}>{t("common.close")}</button>
      {(!checked || notes.length > 0) && <button type="button" disabled={busy} onClick={() => void recover()} className="px-3 py-2 rounded bg-blue-600 text-white">{t(checked ? "common.retry" : "common.confirm")}</button>}
    </div>
  </ThemeDialog>;
};
