type DashboardTopbarProps = {
  eyebrow: string;
  title: string;
  meta: string;
  links: Array<
    | {
        kind: "anchor";
        href: string;
        label: string;
        emphasis?: "primary";
      }
    | {
        kind: "button";
        label: string;
        onClick: () => void;
      }
  >;
};

export function DashboardTopbar({
  eyebrow,
  title,
  meta,
  links
}: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-copy">
        <div className="eyebrow">{eyebrow}</div>
        <strong className="dashboard-topbar-title">{title}</strong>
        <div className="host-badge">{meta}</div>
      </div>

      <nav className="nav-links">
        {links.map((link) =>
          link.kind === "anchor" ? (
            <a
              className={link.emphasis === "primary" ? "nav-link nav-link-primary" : "nav-link"}
              href={link.href}
              key={`${link.kind}-${link.href}-${link.label}`}
            >
              {link.label}
            </a>
          ) : (
            <button
              className="link-button nav-link"
              key={`${link.kind}-${link.label}`}
              onClick={link.onClick}
              type="button"
            >
              {link.label}
            </button>
          )
        )}
      </nav>
    </header>
  );
}
