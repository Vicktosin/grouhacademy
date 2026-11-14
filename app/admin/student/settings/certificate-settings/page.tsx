"use client";

import AdminShell from "@/components/AdminShell";
import AdminSettings, {
  SettingsActions,
  SettingsField,
  SettingsToggle,
} from "@/components/AdminSettings";
import { useAdminPlatformSettings } from "@/components/useAdminPlatformSettings";

export default function CertificateSettingsPage() {
  const { settings, error, saving, message, save } = useAdminPlatformSettings();
  return (
    <AdminShell workspace="student">
      <AdminSettings
        active="certificate-settings"
        title="Certificate rules"
        description="Define the certificate identity (issuer, number prefixes, logo) and automatic issuing policy. The issuer name and logo appear on course and internship certificates."
      >
        {error && <p className="pt-5 text-xs text-red-600">{error}</p>}
        {!settings && !error && (
          <p className="pt-5 text-xs text-slate-500">Loading settings...</p>
        )}
        {settings && (
          <form
            className="pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save({
                certificateIssuerName: data.get("certificateIssuerName"),
                certificatePrefix: data.get("certificatePrefix"),
                certificateNumberPrefix: data.get("certificateNumberPrefix"),
                certificateLogoUrl: data.get("certificateLogoUrl") ?? "",
                certificateMinimumCompletion: Number(
                  data.get("certificateMinimumCompletion"),
                ),
                automaticCertificateIssue: data.has(
                  "automaticCertificateIssue",
                ),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField
                label="Issuing organisation"
                name="certificateIssuerName"
                defaultValue={settings.certificateIssuerName}
              />
              <SettingsField
                label="Course certificate prefix"
                name="certificatePrefix"
                defaultValue={settings.certificatePrefix}
              />
              <SettingsField
                label="Internship certificate prefix"
                name="certificateNumberPrefix"
                defaultValue={settings.certificateNumberPrefix}
                placeholder="e.g. SR-INT"
              />
              <SettingsField
                label="Certificate logo (URL or /public path)"
                name="certificateLogoUrl"
                defaultValue={settings.certificateLogoUrl ?? ""}
                placeholder="Empty shows the SabiRole wordmark"
              />
              <SettingsField
                label="Minimum completion (%)"
                name="certificateMinimumCompletion"
                type="number"
                defaultValue={String(settings.certificateMinimumCompletion)}
              />
            </div>
            <div className="mt-7 border-t border-slate-200 pt-5">
              <div className="divide-y divide-slate-100">
                <SettingsToggle
                  name="automaticCertificateIssue"
                  label="Issue certificates automatically"
                  defaultChecked={settings.automaticCertificateIssue}
                  description="Issue a certificate when a learner meets the configured completion requirement."
                />
              </div>
            </div>
            <SettingsActions saving={saving} savedMessage={message} />
          </form>
        )}
      </AdminSettings>
    </AdminShell>
  );
}
