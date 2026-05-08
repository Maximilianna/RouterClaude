import { useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE } from "../config";

const CURRENT_VERSION = "1.2.0";

interface UpdateInfo {
  latestVersion: string | null;
  downloadUrl?: string;
  releaseNotes?: string;
  htmlUrl?: string;
  error?: string;
}

export default function AboutPanel() {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckUpdate() {
    setChecking(true);
    setError(null);
    setUpToDate(false);
    setUpdateInfo(null);
    setShowDialog(false);

    try {
      const res = await fetch(`${API_BASE}/api/update/check?currentVersion=${CURRENT_VERSION}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UpdateInfo = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.latestVersion) {
        setUpdateInfo(data);
        setShowDialog(true);
      } else {
        setUpToDate(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setChecking(false);
    }
  }

  async function handleDownload() {
    if (!updateInfo?.downloadUrl) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(updateInfo.downloadUrl);
    } catch {
      // Fallback: open in default browser via window.open
      window.open(updateInfo.downloadUrl, "_blank");
    }
    setShowDialog(false);
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-100 rounded-2xl p-6 bg-white/80">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-200">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">RouterClaude</h2>
            <p className="text-sm text-gray-400">{t("app.subtitle")}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">{t("about.current_version")}</span>
            <span className="text-sm font-mono font-medium text-gray-900 px-2.5 py-1 bg-gray-100 rounded-lg">
              v{CURRENT_VERSION}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCheckUpdate}
          disabled={checking}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {checking ? t("about.checking") : t("about.check_update")}
        </button>

        {upToDate && (
          <span className="text-sm text-green-600 flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t("about.up_to_date")}
          </span>
        )}

        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>

      {/* Update dialog */}
      {showDialog && updateInfo?.latestVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("about.update_title")}</h3>
                <p className="text-xs text-gray-400">v{CURRENT_VERSION} → v{updateInfo.latestVersion}</p>
              </div>
            </div>

            {updateInfo.releaseNotes && (
              <div className="max-h-40 overflow-y-auto text-sm text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs font-medium text-gray-400 mb-1">{t("about.release_notes")}</p>
                <div className="whitespace-pre-wrap">{updateInfo.releaseNotes}</div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                {t("about.later")}
              </button>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 transition-all duration-200"
              >
                {t("about.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
