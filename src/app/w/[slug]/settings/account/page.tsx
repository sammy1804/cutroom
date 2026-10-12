import type { Metadata } from "next";
import { AccountForm } from "@/components/settings/account-form";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return <AccountForm name={user.name} email={user.email} />;
}
