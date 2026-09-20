import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import type { DeepLinkInstallRequest } from "../../hooks/useDeepLinkInstall";
import type { RegistryPluginWithStatus } from "../../types/plugins";
import type { ThemeRegistrySnapshot } from "../../utils/themeDiscovery";
import { ThemeRegistryInstall } from "../settings/ThemeDiscovery";
import { ThemeDialog } from "../ui/ThemeDialog";

interface ThemeDeepLinkInstallProps { request: DeepLinkInstallRequest; preview: RegistryPluginWithStatus; onClose: () => void }

export function ThemeDeepLinkInstall({ request, preview, onClose }: ThemeDeepLinkInstallProps) {
  const { t } = useTranslation();
  const { refreshCatalog } = useTheme();
  const [snapshot, setSnapshot] = useState<ThemeRegistrySnapshot>();
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void invoke<ThemeRegistrySnapshot>("fetch_theme_registry", { packageName: request.slug }).then((result) => { if (!disposed) setSnapshot(result); }).catch((failure) => { if (!disposed) setError(String(failure)); });
    return () => { disposed = true; };
  }, [request.slug]);
  const selectedPlugin = snapshot?.plugins.find((plugin) => plugin.id === request.slug);
  if (snapshot && selectedPlugin) return <ThemeRegistryInstall isOpen onClose={onClose} snapshot={snapshot} plugin={selectedPlugin} requestedRegistry={request.registry} initialVersion={request.version || ""} onCommitted={async () => { await refreshCatalog(); }} />;
  return <ThemeDialog isOpen onClose={onClose} title={preview.name}>{error || snapshot ? <p role="alert">{error || t("themePackages.noThemes")}</p> : <p role="status">{t("themePackages.loading")}</p>}</ThemeDialog>;
}
