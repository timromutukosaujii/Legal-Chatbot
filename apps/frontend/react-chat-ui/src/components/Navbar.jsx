export default function Navbar({ onToggleSidebar, onToggleTheme, theme }) {
  return (
    <header className="topbar">
      <div className="topbar-copy-wrap">
        <button type="button" className="mobile-menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          Menu
        </button>
        <img src="/adhikar-logo.svg" alt="Adhikar logo" className="brand-logo topbar-logo" />
        <div className="topbar-copy">
          <h2>Adhikar</h2>
          <small className="brand-meaning">right / entitlement</small>
        </div>
      </div>
      <div className="topbar-actions">
        <button type="button" className="ghost" onClick={onToggleTheme}>
          {theme === "dark" ? "Light" : "Dark"} mode
        </button>
      </div>
    </header>
  );
}
