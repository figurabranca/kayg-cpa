/** @type {import('next').NextConfig} */

// Nome do repositório no GitHub Pages (ex: usuario.github.io/kayg-cpa/)
// Se publicado como usuario.github.io (repo raiz), deixe BASE_PATH vazio.
const REPO_NAME = process.env.NEXT_PUBLIC_BASE_PATH || '/kayg-cpa';
const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Caminhos relativos/base path apenas quando publicado no GitHub Pages
  basePath: isGithubPages ? REPO_NAME : '',
  assetPrefix: isGithubPages ? `${REPO_NAME}/` : '',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
