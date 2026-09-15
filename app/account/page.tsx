// The Account page ("/account"): who you're signed in as, and changing your
// password.
//
// This file stays a Server Component so it can set the browser tab title
// (metadata only works on the server). Everything interactive lives in
// AccountSettings, a Client Component — the pattern the Next.js docs recommend.
import type { Metadata } from "next";
import AccountSettings from "./AccountSettings";

export const metadata: Metadata = {
  title: "Account",
};

export default function AccountPage() {
  return <AccountSettings />;
}
