import { StorefrontCartCount } from "./storefront-cart-count";

type StorefrontHeaderProps = {
  storeId: string;
  storeTitle: string;
  logoUrl?: string | null;
  announcementText?: string | null;
  searchValue?: string | null;
  navigation: Array<{
    href: string;
    label: string;
    emphasis?: "primary";
  }>;
};

export function StorefrontHeader({
  storeId,
  storeTitle,
  logoUrl,
  announcementText,
  searchValue,
  navigation
}: StorefrontHeaderProps) {
  return (
    <>
      {announcementText ? (
        <div className="announcement-strip">{announcementText}</div>
      ) : null}
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <a className="storefront-wordmark" href="/">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={storeTitle} className="storefront-wordmark-logo" src={logoUrl} />
            ) : null}
            <span>{storeTitle}</span>
          </a>

          <nav className="storefront-nav" aria-label="Principal">
            {navigation.map((item) => (
              <a
                className={item.emphasis === "primary" ? "storefront-nav-link storefront-nav-link-accent" : "storefront-nav-link"}
                href={item.href}
                key={`${item.href}-${item.label}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="storefront-header-actions">
            <form action="/catalog" className="storefront-search">
              <span aria-hidden="true" className="storefront-search-icon">
                ⌕
              </span>
              <input
                defaultValue={searchValue ?? ""}
                name="search"
                placeholder="Buscar produtos"
                type="search"
              />
            </form>
            <a className="storefront-account-link" href="#conta">
              Conta
            </a>
            <a className="storefront-cart-link" href="/cart">
              Sacola
              <StorefrontCartCount storeId={storeId} />
            </a>
          </div>
        </div>
      </header>
    </>
  );
}
