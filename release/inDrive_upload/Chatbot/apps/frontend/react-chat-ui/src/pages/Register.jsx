import { useEffect, useRef, useState } from "react";
import { googleAuth, registerUser, setStoredToken } from "../services/auth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function ensureGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-google-identity="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export default function Register({ onAuthed, onNavigateLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const googleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return;

    ensureGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        googleRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            try {
              const data = await googleAuth(response.credential);
              setStoredToken(data.token);
              onAuthed(data.token, data.user);
            } catch (err) {
              setError(err.message || "Google sign-up failed");
            }
          }
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: "outline",
          size: "large",
          text: "signup_with",
          shape: "pill",
          width: 320
        });
      })
      .catch(() => {
        setError("Google sign-up could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [onAuthed]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await registerUser({ name, email, password });
      setStoredToken(data.token);
      onAuthed(data.token, data.user);
    } catch (err) {
      setError(err.message || "Registration failed");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Register</h1>
        <p>Create your AI Legal Assistant account</p>

        <form onSubmit={submit}>
          <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></label>
          {error ? <p className="error-banner">{error}</p> : null}
          <button type="submit" className="primary">Sign up</button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <div className="google-wrap" ref={googleRef} />
        {!GOOGLE_CLIENT_ID ? <p className="auth-hint">Set `VITE_GOOGLE_CLIENT_ID` to enable Google sign-up.</p> : null}

        <p>Already have an account? <button type="button" className="link-btn" onClick={onNavigateLogin}>Login</button></p>
      </section>
    </main>
  );
}
