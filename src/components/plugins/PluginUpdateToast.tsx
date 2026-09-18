import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePluginRegistry } from "../../hooks/usePluginRegistry";
import { useToast } from "../../hooks/useToast";

export function PluginUpdateToast() {
  const { updates, loading, error } = usePluginRegistry();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const notified = useRef(false);

  useEffect(() => {
    if (notified.current || loading || error || updates.length === 0) return;
    notified.current = true;
    const openPlugins = () => navigate("/settings?tab=plugins&filter=updates");
    showToast(t("update.badges.plugins", { count: updates.length }), {
      kind: "success",
      title: t("update.badges.toastTitle"),
      duration: 12000,
      onClick: openPlugins,
      actions: [
        { label: t("update.badges.openPlugins"), onClick: openPlugins },
      ],
    });
  }, [updates.length, loading, error, showToast, navigate, t]);

  return null;
}
