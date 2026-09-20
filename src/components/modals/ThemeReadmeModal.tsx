import { useEffect, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { ThemeDialog } from "../ui/ThemeDialog";
import type { PluginReadme } from "../../types/plugins";
import type { ThemeRegistryPlugin } from "../../utils/themeDiscovery";
import { safeThemeExternalUrl, themeReadmeHtml } from "../../utils/themeReadme";
import { toRegistryLocale } from "../../i18n/registryLocale";

interface Props { plugin: ThemeRegistryPlugin; registryUrl: string; onClose: () => void }

export function ThemeReadmeModal({ plugin, registryUrl, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const locale = toRegistryLocale(i18n.resolvedLanguage ?? i18n.language ?? "en");
  const [readme, setReadme] = useState<{ html: string; data: PluginReadme }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void invoke<PluginReadme>("fetch_plugin_readme", { slug: plugin.id, locale, registryUrl }).then((data) => {
      if (!disposed) setReadme({ data, html: themeReadmeHtml(data.html ?? "", data.repo_url ?? null) });
    }).catch((failure) => { if (!disposed) setError(String(failure)); });
    return () => { disposed = true; };
  }, [plugin.id, registryUrl, locale]);
  const open = (url: string) => { void openUrl(url).catch((failure) => setError(String(failure))); };
  const link = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    event.preventDefault();
    const url = safeThemeExternalUrl(anchor.getAttribute("href"));
    if (url) open(url);
  };
  const docs = safeThemeExternalUrl(readme?.data.documentation_url);
  const screenshots = (plugin.screenshots ?? []).flatMap((image) => {
    const url = safeThemeExternalUrl(image.url); return url ? [{ ...image, url }] : [];
  });
  return <ThemeDialog isOpen onClose={onClose} title={`${plugin.name} · ${t("themePackages.readme")}`}>
    <p className="text-sm text-muted">{t("themePackages.externalMedia")}</p>
    {screenshots.length > 0 && <section aria-label={t("themePackages.screenshots")}><h3 className="font-semibold">{t("themePackages.screenshots")}</h3><ul>{screenshots.map((image, index) => <li key={`${image.url}:${index}`}><button type="button" onClick={() => open(image.url)} className="text-blue-400 underline text-left break-words">{image.caption?.trim() || image.alt?.trim() || `${t("themePackages.screenshots")} ${index + 1}`}</button></li>)}</ul></section>}
    {!readme && !error && <p role="status">{t("themePackages.loading")}</p>}
    {readme?.data.locale && readme.data.locale !== locale && <p className="text-xs text-muted">{readme.data.locale}</p>}
    {readme?.html ? <div onClick={link} onAuxClick={link} className="text-sm [&_h1]:text-lg [&_h2]:text-base [&_p]:mb-2 [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:bg-base [&_a]:text-blue-400 [&_a]:underline" dangerouslySetInnerHTML={{ __html: readme.html }} /> : readme && <p>{t("connectionCatalogue.readmeUnavailable")}</p>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="flex justify-end gap-3">{docs && <button type="button" onClick={() => open(docs)}>{t("connectionCatalogue.openDocumentation")}</button>}<button type="button" onClick={onClose}>{t("common.close")}</button></div>
  </ThemeDialog>;
}
