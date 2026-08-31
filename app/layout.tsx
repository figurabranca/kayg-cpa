import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'KAYG CPA — Painel Financeiro',
  description: 'Plataforma financeira e operacional KAYG CPA.',
};

// Complementa o fix de /public/404.html: se a página foi carregada a
// partir de um redirect do GitHub Pages (?redirect=/extrato), reescreve
// a URL para o caminho real ANTES do Next Router inicializar, para que a
// navegação por F5 em rotas internas funcione corretamente no celular.
const REDIRECT_FIX_SCRIPT = `
(function () {
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');
  if (redirect) {
    var target = window.location.pathname.replace(/\\/?$/, '/') + redirect.replace(/^\\//, '');
    window.history.replaceState(null, '', target);
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="pt-BR">
      <head>
        <Script id="gh-pages-redirect-fix" strategy="beforeInteractive">
          {REDIRECT_FIX_SCRIPT}
        </Script>
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
