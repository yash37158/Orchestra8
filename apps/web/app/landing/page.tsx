import { redirect } from "next/navigation"

/**
 * The landing page moved to the root, where visitors actually arrive.
 *
 * This route stays so anything already pointing at /landing keeps working —
 * it was a second, diverging copy of the same page, which is how one of them
 * ended up describing a different product from the other.
 */
export default function LandingRedirect() {
  redirect("/")
}
