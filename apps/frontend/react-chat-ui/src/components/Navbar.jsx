export default function Navbar({ onToggleSidebar, onToggleTheme, theme }) {
  return (
    <header className="topbar">
      <div className="topbar-copy-wrap">
        <button type="button" className="mobile-menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          Menu
        </button>
        <div className="topbar-copy">
          <h2>UK Rights Legal Assistant</h2>
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
