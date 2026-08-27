import { SignUp } from "@clerk/nextjs";
import { applicationHomeUrl } from "@/lib/application-url";
import { AuthStory } from "@/components/AuthStory";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <AuthStory mode="sign-up" />
      <section className="auth-panel">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl={applicationHomeUrl}
        />
      </section>
    </main>
  );
}
