import Link from "next/link";
import { db } from "@/lib/supabase";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data } = await db().from("settings").select("voice_samples, extra_rules").eq("id", 1).maybeSingle();
  return (
    <div className="shell narrow stack">
      <header className="top">
        <h1>Settings</h1>
        <Link href="/" className="small-link">
          ← Back
        </Link>
      </header>
      <SettingsForm
        initial={{ voice_samples: (data?.voice_samples as string) ?? "", extra_rules: (data?.extra_rules as string) ?? "" }}
      />
    </div>
  );
}
