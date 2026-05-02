import { redirect } from "next/navigation";

/** Legacy-URL; Proxy leitet meist schon auf `/login` um. */
export default function AnmeldenPage() {
  redirect("/login");
}
