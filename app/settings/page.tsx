import Link from "next/link";
import AccountPanel from "@/components/AccountPanel";
import SettingsForm from "@/components/SettingsForm";
import { getSettings } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="shell narrow stack">
      <header className="top">
        <h1>Settings</h1>
        <Link href="/" className="small-link">
          ← Back
        </Link>
      </header>
      <AccountPanel initial={settings} />
      <SettingsForm initial={settings} />
    </div>
  );
}
