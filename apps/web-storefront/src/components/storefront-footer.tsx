type StorefrontFooterProps = {
  storeTitle: string;
};

const footerLinks = [
  { href: "/catalog?collection=new", label: "Novidades" },
  { href: "/catalog", label: "Roupas" },
  { href: "/catalog", label: "Acessorios" },
  { href: "/catalog?collection=sale", label: "Sale" }
];

const helpLinks = [
  "Trocas e devolucoes",
  "Entrega e frete",
  "Guia de tamanhos",
  "Fale conosco"
];

export function StorefrontFooter({ storeTitle }: StorefrontFooterProps) {
  return (
    <footer className="storefront-footer">
      <div className="storefront-footer-grid shell">
        <div>
          <div className="storefront-footer-brand">{storeTitle}</div>
          <p className="storefront-footer-copy">
            Moda atemporal, pensada para uma compra leve e sem friccao do primeiro clique ao checkout.
          </p>
        </div>

        <div>
          <div className="storefront-footer-label">Loja</div>
          <div className="storefront-footer-links">
            {footerLinks.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="storefront-footer-label">Ajuda</div>
          <div className="storefront-footer-links">
            {helpLinks.map((item) => (
              <a href="#ajuda" key={item}>
                {item}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="storefront-footer-label">Receba novidades</div>
          <form className="storefront-newsletter">
            <input placeholder="Seu e-mail" type="email" />
            <button type="submit">OK</button>
          </form>
        </div>
      </div>

      <div className="storefront-footer-bottom shell">
        <span>{`© 2026 ${storeTitle}. Todos os direitos reservados.`}</span>
        <span>Pagamento seguro · Pix, cartao e boleto</span>
      </div>
    </footer>
  );
}
