import { SignIn } from "@clerk/nextjs";
import { applicationHomeUrl } from "@/lib/application-url";
import { AuthStory } from "@/components/AuthStory";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <AuthStory mode="sign-in" />
      <section className="auth-panel">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={applicationHomeUrl}
        />
      </section>
    </main>
  );
}
