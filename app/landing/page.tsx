import { redirect } from "next/navigation";

/** Legacy URL. Marketing home is now `/`. */
export default function LegacyLandingRedirect() {
  redirect("/");
}
