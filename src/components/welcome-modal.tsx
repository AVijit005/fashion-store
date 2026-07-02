import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EASE } from "@/lib/motion";
import { apiClient } from "@/lib/api/client";

const KEY = "ink-welcome-seen";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* noop */
    }
  };

  // Phase 4 fix: the previous handler swallowed the email — it called
  // close() without ever calling the backend, so the address was
  // discarded (and may have breached GDPR if we claimed to subscribe).
  // We now POST to /newsletter/subscribe and show explicit feedback.
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    const trimmed = email.trim();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setErrorMessage("Please enter a valid email address");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await apiClient.post("/newsletter/subscribe", {
        email: trimmed,
        source: "welcome_modal",
      });
      setStatus("success");
      toast.success("Confirmation email sent. Check your inbox.");
      // Close after a short delay so the user sees the toast.
      setTimeout(() => close(), 800);
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Couldn't subscribe. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid w-full max-w-3xl grid-cols-1 overflow-hidden bg-paper sm:grid-cols-2"
          >
            <button
              onClick={close}
              aria-label="Close welcome offer"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-paper/90 hover:bg-fog"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="hidden bg-fog sm:block">
              <img
                src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80&auto=format&fit=crop"
                alt="Welcome to Ink Studio"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-8 sm:p-10">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">First visit</p>
              <h2
                id="welcome-modal-title"
                className="mt-2 font-display text-4xl leading-[0.95] sm:text-5xl"
              >
                10% off your <span className="italic">first piece.</span>
              </h2>
              <p className="mt-3 text-sm text-mute">
                Drop your email for the welcome code, early-access to drops, and the studio
                newsletter.
              </p>
              <form
                onSubmit={onSubmit}
                className="mt-6 flex flex-col gap-2"
                aria-busy={status === "submitting"}
              >
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="you@inkstudio.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    disabled={status === "submitting"}
                    aria-invalid={status === "error"}
                    className="flex-1 border border-line bg-transparent px-3 py-3 text-sm outline-none focus:border-ink disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={status === "submitting" || status === "success"}
                    className="bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.22em] text-paper disabled:opacity-60"
                  >
                    {status === "submitting" ? "Sending…" : status === "success" ? "Sent" : "Claim"}
                  </button>
                </div>
                {status === "error" && errorMessage && (
                  <p role="alert" className="text-[11px] text-accent">
                    {errorMessage}
                  </p>
                )}
              </form>
              <button
                onClick={close}
                className="mt-4 text-[12px] uppercase tracking-[0.18em] text-mute hover:text-ink"
              >
                No thanks
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
