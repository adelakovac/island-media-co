"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Session } from "@/lib/client/types";

export default function SignupPage() {
  const router = useRouter();
  const { setSession } = useSession();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);

  const [organisationName, setOrganisationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await apiFetch<Session>("/api/auth/register", {
        method: "POST",
        idempotencyKey,
        body: { organisationName, contactName, email },
      });
      setSession(session);
      router.push("/portal");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-xl font-semibold text-brand-carbon">Sign up as a new client</h1>
      <p className="mt-1 text-sm text-brand-carbon/70">
        Create an organisation and contact to browse the catalogue and submit advertising requests.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="organisationName">Organisation name</Label>
            <Input
              id="organisationName"
              required
              minLength={2}
              value={organisationName}
              onChange={(event) => setOrganisationName(event.target.value)}
              placeholder="Acme Fitness Ltd"
            />
          </div>
          <div>
            <Label htmlFor="contactName">Your name</Label>
            <Input
              id="contactName"
              required
              minLength={2}
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Jamie Rivera"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jamie@acmefitness.test"
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
