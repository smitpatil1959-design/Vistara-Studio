import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ClockAlert,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import Logo from '../components/layout/Logo';
import Ambient from '../components/layout/Ambient';
import FullScreenLoader from '../components/auth/FullScreenLoader';
import { useAuth } from '../hooks/useAuth';
import type { AuthFailure } from '../lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared production surface for /login and /signup with polished SaaS animations. */
export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { signIn, signInWithGoogle, signUp, isAuthenticated, loading } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const isSignup = mode === 'signup';

  const next = params.get('next') || '/dashboard';
  const expired = params.get('expired') === '1';
  const registered = params.get('registered') === '1';

  const [email, setEmail] = useState(() => params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [info, setInfo] = useState(() => (
    registered && !isSignup
      ? 'Account created successfully. If email confirmation is enabled, check your inbox before signing in.'
      : ''
  ));

  // Subtle password strength evaluation for signup
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '', percent: 0 };
    let s = 0;
    if (password.length >= 6) s += 1;
    if (password.length >= 10) s += 1;
    if (/[0-9]/.test(password)) s += 1;
    if (/[^a-zA-Z0-9]/.test(password) || /[A-Z]/.test(password)) s += 1;

    if (s === 1) return { score: 1, label: 'Weak', color: '#c85a53', percent: 25 };
    if (s === 2) return { score: 2, label: 'Fair', color: '#b88220', percent: 50 };
    if (s === 3) return { score: 3, label: 'Good', color: '#6b8e64', percent: 75 };
    return { score: 4, label: 'Strong', color: '#42570a', percent: 100 };
  }, [password]);

  // Confirm password match check
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword || !password) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  if (loading) return <FullScreenLoader label="Checking session…" />;
  if (isAuthenticated) return <Navigate to={next} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    setInfo('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFailure({ code: 'invalid', message: 'Enter your email address.' });
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setFailure({ code: 'invalid', message: 'Enter a valid email address.' });
      return;
    }
    if (!password) {
      setFailure({ code: 'invalid', message: 'Enter your password.' });
      return;
    }
    if (isSignup && password.length < 6) {
      setFailure({ code: 'invalid', message: 'Password must be at least 6 characters long.' });
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setFailure({ code: 'invalid', message: 'Passwords do not match. Please verify and try again.' });
      return;
    }

    setBusy(true);
    const result = isSignup ? await signUp(cleanEmail, password) : await signIn(cleanEmail, password);
    setBusy(false);

    if (result.ok) {
      if (isSignup) {
        setSignupSuccess(true);
        setTimeout(() => {
          nav(`/login?registered=1&email=${encodeURIComponent(cleanEmail)}&next=${encodeURIComponent(next)}`, { replace: true });
        }, 1300);
      } else {
        nav(next, { replace: true });
      }
    } else if (result.failure) {
      setFailure(result.failure);
    }
  };

  const continueWithGoogle = async () => {
    if (busy) return;
    setFailure(null);
    setInfo('');
    setBusy(true);
    const requestedNext = new URL(next, window.location.origin);
    const redirectTo = (
      requestedNext.origin === window.location.origin
        ? requestedNext
        : new URL('/dashboard', window.location.origin)
    ).toString();
    const result = await signInWithGoogle(redirectTo);
    if (!result.ok) {
      setBusy(false);
      if (result.failure) setFailure(result.failure);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <Ambient />
      <header className="px-6 pt-6">
        <Link to="/" aria-label="Vistara Studio home">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-3xl bg-white p-8 md:p-9 noise relative overflow-hidden">
            {/* Subtle floating ambient orb top-right */}
            <motion.div
              className="absolute -top-16 -right-16 w-60 h-60 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(closest-side, rgba(217,242,107,0.45), transparent)',
                filter: 'blur(30px)',
              }}
              animate={shouldReduceMotion ? {} : {
                x: [0, 10, -6, 0],
                y: [0, -8, 6, 0],
                scale: [1, 1.04, 0.98, 1],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Subtle floating ambient orb bottom-left */}
            <motion.div
              className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(closest-side, rgba(157,180,148,0.28), transparent)',
                filter: 'blur(32px)',
              }}
              animate={shouldReduceMotion ? {} : {
                x: [0, -6, 8, 0],
                y: [0, 8, -6, 0],
                scale: [1, 0.97, 1.03, 1],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            <AnimatePresence mode="wait" initial={false}>
              {signupSuccess ? (
                /* Premium animated success state after account creation */
                <motion.div
                  key="signup-success"
                  initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="py-10 text-center flex flex-col items-center justify-center gap-4"
                >
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 text-lime-deep" viewBox="0 0 52 52">
                      <motion.circle
                        cx="26"
                        cy="26"
                        r="23"
                        fill="none"
                        stroke="rgba(66, 87, 10, 0.18)"
                        strokeWidth="2.5"
                      />
                      <motion.circle
                        cx="26"
                        cy="26"
                        r="23"
                        fill="none"
                        stroke="#42570a"
                        strokeWidth="2.5"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.path
                        fill="none"
                        stroke="#42570a"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.5 27.5l7.5 7.5 15.5-16"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
                      Account created successfully.
                    </h2>
                    <p className="text-fog text-sm mt-1.5 flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin text-lime-deep" />
                      Redirecting to sign in…
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                /* Standard form surface with fluid transition between /login and /signup */
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : isSignup ? 8 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: shouldReduceMotion ? 0 : isSignup ? -8 : 8 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="chip-lime rounded-full px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] inline-flex transition-transform hover:scale-[1.02]">
                    {isSignup ? 'Create account' : 'Welcome back'}
                  </span>

                  <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mt-4">
                    {isSignup ? 'Start presenting websites.' : 'Sign in to the studio.'}
                  </h1>
                  <p className="text-fog text-[13.5px] mt-2 leading-relaxed">
                    {isSignup
                      ? 'Your studies, briefs and decks follow your account.'
                      : 'Pick up where you left off — every study is exactly as you saved it.'}
                  </p>

                  <AnimatePresence>
                    {expired && (
                      <motion.p
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        role="status"
                        className="mt-5 text-[12.5px] text-[#8a6d1c] bg-[#faf1d6] border border-[#e8d5a4] rounded-xl px-3.5 py-2.5 flex items-start gap-2 overflow-hidden"
                      >
                        <ClockAlert size={14} className="mt-0.5 shrink-0" /> Your session expired — sign back in to continue.
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <form onSubmit={submit} className="mt-7 flex flex-col gap-3" noValidate>
                    {/* Email field */}
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Email</span>
                      <div className="mt-1.5 input-ghost rounded-xl px-3.5 py-3 flex items-center gap-2.5 focus-within:ring-4 focus-within:ring-[rgba(217,242,107,0.45)]">
                        <Mail size={14} className="text-fog shrink-0 transition-colors group-focus-within:text-ink" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@studio.com"
                          autoComplete="email"
                          className="flex-1 bg-transparent outline-none text-sm min-w-0 placeholder:text-fog/50"
                        />
                      </div>
                    </label>

                    {/* Password field */}
                    <label className="block">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Password</span>
                        {isSignup && password.length > 0 && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[11px] font-mono font-medium"
                            style={{ color: passwordStrength.color }}
                          >
                            {passwordStrength.label}
                          </motion.span>
                        )}
                      </div>
                      <div className="mt-1.5 input-ghost rounded-xl px-3.5 py-3 flex items-center gap-2.5 focus-within:ring-4 focus-within:ring-[rgba(217,242,107,0.45)]">
                        <KeyRound size={14} className="text-fog shrink-0" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6+ characters"
                          autoComplete={isSignup ? 'new-password' : 'current-password'}
                          className="flex-1 bg-transparent outline-none text-sm min-w-0 placeholder:text-fog/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="text-fog hover:text-ink transition-colors p-1 rounded-md focus:outline-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      {/* Smooth animated password strength bar on signup */}
                      {isSignup && password.length > 0 && (
                        <div className="h-1 w-full bg-line/30 rounded-full mt-2 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${passwordStrength.percent}%`, backgroundColor: passwordStrength.color }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      )}
                    </label>

                    {/* Confirm Password field on signup */}
                    {isSignup && (
                      <motion.label
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="block overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Confirm Password</span>
                          {passwordsMatch !== null && (
                            <span
                              className={`text-[11px] font-mono flex items-center gap-1 ${
                                passwordsMatch ? 'text-lime-deep' : 'text-[#c85a53]'
                              }`}
                            >
                              {passwordsMatch ? (
                                <>
                                  <Check size={12} className="stroke-[2.5]" /> Match
                                </>
                              ) : (
                                'Mismatch'
                              )}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 input-ghost rounded-xl px-3.5 py-3 flex items-center gap-2.5 focus-within:ring-4 focus-within:ring-[rgba(217,242,107,0.45)]">
                          <KeyRound size={14} className="text-fog shrink-0" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            autoComplete="new-password"
                            className="flex-1 bg-transparent outline-none text-sm min-w-0 placeholder:text-fog/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((p) => !p)}
                            className="text-fog hover:text-ink transition-colors p-1 rounded-md focus:outline-none"
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                          >
                            {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </motion.label>
                    )}

                    {/* Animated error banner */}
                    <AnimatePresence mode="wait">
                      {failure && (
                        <motion.div
                          key="auth-failure"
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          role="alert"
                          className="text-[12.5px] text-[#a2403a] bg-[#f9e3e0] border border-[#ecc5c0] rounded-xl px-3.5 py-2.5 overflow-hidden"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#a2403a]" />
                            <div className="flex-1">
                              <p>{failure.message}</p>
                              {failure.code === 'duplicate' && (
                                <Link
                                  to={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email.trim())}`}
                                  className="font-semibold underline underline-offset-2 mt-1 inline-block hover:opacity-80 transition-opacity"
                                >
                                  Go to sign in
                                </Link>
                              )}
                              {failure.code === 'invalid' && !isSignup && (
                                <Link
                                  to={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email.trim())}`}
                                  className="font-semibold underline underline-offset-2 mt-1.5 inline-block text-lime-deep hover:text-ink transition-colors"
                                >
                                  Don't have an account yet? Create one here →
                                </Link>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Animated info banner */}
                    <AnimatePresence mode="wait">
                      {info && (
                        <motion.p
                          key="auth-info"
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          role="status"
                          className="text-[12.5px] text-sage-deep bg-[#e7efe2] border border-[#c4d4bb] rounded-xl px-3.5 py-2.5 flex items-start gap-2 overflow-hidden"
                        >
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-lime-deep" />
                          <span>{info}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Submit button with refined micro-interactions */}
                    <motion.button
                      type="submit"
                      disabled={busy}
                      whileHover={busy ? {} : { y: -1, boxShadow: '0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 16px 34px -14px rgba(23, 23, 15, 0.5)' }}
                      whileTap={busy ? {} : { scale: 0.985, y: 0 }}
                      className="btn-grad rounded-xl px-5 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 mt-1 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <Loader2 size={15} className="animate-spin text-paper" />
                      ) : (
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                      )}
                      <span>
                        {busy ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
                      </span>
                    </motion.button>
                  </form>

                  <div className="flex items-center gap-3 my-5" aria-hidden="true">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">or continue with</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <motion.button
                    type="button"
                    onClick={continueWithGoogle}
                    disabled={busy}
                    whileHover={busy ? {} : { y: -1, boxShadow: '0 10px 24px -16px rgba(23, 23, 15, 0.3)' }}
                    whileTap={busy ? {} : { scale: 0.99 }}
                    className="w-full rounded-xl border border-line bg-white/80 px-5 py-3.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-sage/50 hover:bg-white flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? (
                      <Loader2 size={17} className="animate-spin text-sage-deep" />
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 48 48" className="w-[18px] h-[18px]">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.05 46.98 31.95 46.98 24.55Z" />
                        <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                      </svg>
                    )}
                    <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
                  </motion.button>

                  {/* Toggle between Signup and Login */}
                  <div className="flex items-center justify-between mt-6 text-[12.5px]">
                    {isSignup ? (
                      <span className="text-fog">
                        Already have an account?{' '}
                        <Link
                          to={`/login?next=${encodeURIComponent(next)}`}
                          className="text-lime-deep font-medium hover:text-ink transition-colors hover:underline underline-offset-2"
                        >
                          Sign in
                        </Link>
                      </span>
                    ) : (
                      <span className="text-fog">
                        New to Vistara?{' '}
                        <Link
                          to={`/signup?next=${encodeURIComponent(next)}`}
                          className="text-lime-deep font-medium hover:text-ink transition-colors hover:underline underline-offset-2"
                        >
                          Create an account
                        </Link>
                      </span>
                    )}
                  </div>

                  <div className="border-t border-line mt-6 pt-5">
                    <Link
                      to="/gallery"
                      className="btn-quiet w-full rounded-xl px-4 py-2.5 text-[12.5px] text-center block transition-all"
                    >
                      Watch the live sample deck — no account needed
                    </Link>
                    <p className="text-[11px] text-fog/70 mt-3 text-center flex items-center justify-center gap-1.5">
                      <ShieldCheck size={11} /> Analyzing a site requires a free account. Decks stay private by default.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-2.5 mt-5">
            {['Measured crawls', 'Schema-native decks', 'Undo-safe editing'].map((t) => (
              <span key={t} className="text-[10px] font-mono text-fog/70 glass bg-white rounded-full px-3 py-1.5">
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
