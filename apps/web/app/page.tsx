import { redirect } from "next/navigation";

/**
 * Sends visitors to the canonical login route.
 *
 * @returns Never returns because Next.js handles the redirect.
 */
export default function Home() {
  redirect("/auth/login");
}
