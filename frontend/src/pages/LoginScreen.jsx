import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { validateEmail, validateForm, validatePassword } from "../utils/validation";
import { login, signup, SAFE_MESSAGES } from "../utils/api";
import ActionButton from "../components/ActionButton";
import BrandLogo from "../components/BrandLogo";
import FormField from "../components/FormField";
import HeroShader from "../components/ui/hero";
import duskSrc from "../assets/standpoint-dusk.jpg";

const FEATURES = [
  {
    icon: MapPin,
    title: "Know the spot",
    description: "Location, date and crew in one plan",
  },
  {
    icon: Sparkles,
    title: "Catch the light",
    description: "Golden-hour preview for your slot",
  },
  {
    icon: ShieldCheck,
    title: "Follow the rules",
    description: "Access and consent before you go",
  },
];

export default function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const isSignup = mode === "signup";

  useEffect(() => {
    headingRef.current?.focus();
  }, [mode]);

  const focusField = (fieldName) => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector(`[name="${fieldName}"]`)?.focus();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setApiError("");
    const { firstInvalidField } = validateForm({
      email: () => validateEmail(email),
      password: () => validatePassword(password),
    });

    if (firstInvalidField) {
      setTouched({ email: true, password: true });
      focusField(firstInvalidField);
      return;
    }

    setLoading(true);
    try {
      const authenticate = isSignup ? signup : login;
      const response = await authenticate(email.trim(), password);

      if (!response?.user || !response?.access_token) {
        throw new Error(SAFE_MESSAGES.SERVICE_UNAVAILABLE);
      }

      onLogin(response.user, response.access_token);
      navigate("/shoot-details");
    } catch (error) {
      const safeMessages = Object.values(SAFE_MESSAGES);
      const fallback = isSignup
        ? SAFE_MESSAGES.ACCOUNT_CREATION_FAILED
        : SAFE_MESSAGES.SERVICE_UNAVAILABLE;
      setApiError(safeMessages.includes(error?.message) ? error.message : fallback);
    } finally {
      setPassword("");
      setShowPassword(false);
      setTouched((current) => ({ ...current, password: false }));
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"));
    setPassword("");
    setShowPassword(false);
    setTouched({ email: false, password: false });
    setApiError("");
  };

  const passwordToggle = (
    <button
      type="button"
      className="field-toggle"
      onClick={() => setShowPassword((visible) => !visible)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      aria-pressed={showPassword}
    >
      {showPassword ? (
        <EyeOff size={20} aria-hidden="true" />
      ) : (
        <Eye size={20} aria-hidden="true" />
      )}
    </button>
  );

  return (
    <main className="login-split">
      <section className="login-hero" aria-labelledby="login-hero-title">
        <HeroShader />
        <img className="login-hero-img" src={duskSrc} alt="" />

        <div className="login-hero-content">
          <BrandLogo tone="light" size={38} className="login-hero-logo" />

          <div className="login-hero-copy">
            <p className="login-hero-eyebrow">Photography shoot planner</p>
            <h1 id="login-hero-title" className="login-hero-heading">
              <span>Arrive ready</span>
              <span>to shoot.</span>
            </h1>
            <p className="login-hero-sub">
              Turn a location idea into a permit-ready plan, before the light changes.
            </p>
          </div>

          <div className="login-feature-list">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article className="login-feature-card" key={title}>
                <span className="login-feature-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="login-feature-copy">
                  <strong>{title}</strong>
                  <span>{description}</span>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="login-form-side" aria-labelledby="login-heading">
        <div className="login-card">
          <BrandLogo size={30} className="login-card-logo" />
          <div className="login-intro">
            <h2 id="login-heading" className="login-heading" ref={headingRef} tabIndex="-1">
              Welcome back
            </h2>
            <p className="login-supporting-copy">
              Sign in to plan a shoot and see your saved plans.
            </p>
          </div>

          <form ref={formRef} className="login-form" onSubmit={handleSubmit} noValidate>
            {apiError && (
              <div className="form-alert" role="alert">
                {apiError}
              </div>
            )}

            <FormField
              label="Email address"
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              error={emailError}
              helper="e.g. name@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={loading}
            />

            <FormField
              label="Password"
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              error={passwordError}
              helper="Six or more non-space characters."
              autoComplete={isSignup ? "new-password" : "current-password"}
              endAdornment={passwordToggle}
              disabled={loading}
            />

            <ActionButton type="submit" loading={loading} className="login-submit">
              {isSignup ? "Create account" : "Sign in"}
            </ActionButton>
          </form>

          <p className="login-toggle">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            {" "}
            <button type="button" className="login-toggle-btn" onClick={switchMode} disabled={loading}>
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}