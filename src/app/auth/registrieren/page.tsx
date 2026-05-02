import { redirect } from "next/navigation";

/** Legacy-URL; Proxy leitet meist schon auf `/signup` um. */
export default function RegistrierenPage() {
  redirect("/signup");
}
