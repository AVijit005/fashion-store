import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { syncWishlistOnLogin } from "@/lib/store/wishlist";
import { toast } from "sonner";

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalView,
    setAuthModalView,
    login,
    signup,
    isLoading,
  } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authModalOpen) {
      document.body.style.overflow = "hidden";
      // Clear inputs when opening
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setErrorMsg("");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [authModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email) {
      setErrorMsg("Email is required");
      return;
    }
    if (authModalView !== "forgot-password" && !password) {
      setErrorMsg("Password is required");
      return;
    }

    try {
      if (authModalView === "login") {
        await login(email, password);
        await syncWishlistOnLogin();
        toast.success("Successfully logged in.");
      } else if (authModalView === "signup") {
        if (password.length < 8) {
          setErrorMsg("Password must be at least 8 characters");
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg("Passwords do not match");
          return;
        }
        await signup(email, password);
        await syncWishlistOnLogin();
        toast.success("Account created successfully.");
      } else if (authModalView === "forgot-password") {
        // Simulated premium forgot password response since backend is mocked for recovery
        await new Promise((resolve) => setTimeout(resolve, 800));
        toast.success("Password reset instructions sent to your email.");
        setAuthModalView("login");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An authentication error occurred.";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <AnimatePresence>
      {authModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
          onClick={() => setAuthModalOpen(false)}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-full max-w-md flex-col bg-paper shadow-ink"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                  {authModalView === "login" && "Welcome back"}
                  {authModalView === "signup" && "Join Ink Studio"}
                  {authModalView === "forgot-password" && "Reset access"}
                </p>
                <h2 id="auth-modal-title" className="font-display text-2xl">
                  {authModalView === "login" && "Sign In"}
                  {authModalView === "signup" && "Create Account"}
                  {authModalView === "forgot-password" && "Forgot Password"}
                </h2>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                aria-label="Close authentication panel"
                className="icon-btn"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMsg && (
                  <div className="bg-red-50 p-4 border-l-4 border-red-500 text-red-800 text-xs">
                    <p>{errorMsg}</p>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[10px] uppercase tracking-widest text-mute mb-2"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-mute" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      placeholder="alex@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-line bg-transparent pl-10 pr-4 py-3 text-sm focus:border-ink focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                {authModalView !== "forgot-password" && (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label
                          htmlFor="auth-password"
                          className="block text-[10px] uppercase tracking-widest text-mute"
                        >
                          Password
                        </label>
                        {authModalView === "login" && (
                          <button
                            type="button"
                            onClick={() => setAuthModalView("forgot-password")}
                            className="text-[10px] uppercase tracking-wider text-mute hover:text-ink hover:underline"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-mute" />
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full border border-line bg-transparent pl-10 pr-10 py-3 text-sm focus:border-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3.5 text-mute hover:text-ink"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4.5 w-4.5" />
                          ) : (
                            <Eye className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Confirm Password Field (for signup) */}
                {authModalView === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-[10px] uppercase tracking-widest text-mute mb-2"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-mute" />
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-line bg-transparent pl-10 pr-4 py-3 text-sm focus:border-ink focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-ink py-4 text-[12px] uppercase tracking-[0.2em] text-paper transition-all hover:bg-ink/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      {authModalView === "login" && "Sign In"}
                      {authModalView === "signup" && "Create Account"}
                      {authModalView === "forgot-password" && "Send Reset Link"}
                    </>
                  )}
                </button>
              </form>

              {/* Toggles */}
              <div className="mt-8 text-center text-xs text-mute border-t border-line pt-6">
                {authModalView === "login" ? (
                  <p>
                    New to Ink Studio?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthModalView("signup")}
                      className="text-ink font-semibold hover:underline"
                    >
                      Create account
                    </button>
                  </p>
                ) : authModalView === "signup" ? (
                  <p>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthModalView("login")}
                      className="text-ink font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                ) : (
                  <p>
                    Remember your password?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthModalView("login")}
                      className="text-ink font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
