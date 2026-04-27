import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <div className="bg-black h-screen sm:flex sm:justify-center sm:items-center">
      <LoginForm />
    </div>
  );
}
