import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

interface RouteInfo {
  path: string;
  title: string;
  description?: string;
}

async function getRoutes(): Promise<RouteInfo[]> {
  const appDir = path.join(process.cwd(), "app");
  const routes: RouteInfo[] = [];

  async function scanDirectory(dir: string, basePath: string = "") {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith("(") &&
          !entry.name.startsWith("_")
        ) {
          const fullPath = path.join(dir, entry.name);
          const routePath = `${basePath}/${entry.name}`;

          // メタデータファイルの確認
          let metadata = null;
          try {
            const metadataPath = path.join(fullPath, "metadata.json");
            const metadataContent = await fs.readFile(metadataPath, "utf-8");
            metadata = JSON.parse(metadataContent);
          } catch {
            // メタデータファイルが存在しない場合は無視
          }

          // page.tsx または page.js が存在するかチェック
          const pageFiles = ["page.tsx", "page.ts", "page.jsx", "page.js"];
          let hasPage = false;

          for (const pageFile of pageFiles) {
            try {
              await fs.access(path.join(fullPath, pageFile));
              hasPage = true;
              break;
            } catch {
              // ファイルが存在しない
            }
          }

          if (hasPage) {
            const title =
              metadata?.title ||
              entry.name
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");

            routes.push({
              path: routePath,
              title,
              description: metadata?.description || `${title}ページ`,
            });
          }

          // 再帰的にサブディレクトリをスキャン
          await scanDirectory(fullPath, routePath);
        }
      }
    } catch (error) {
      console.error("Error scanning directory:", error);
    }
  }

  await scanDirectory(appDir);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

export default async function HomePage() {
  const routes = await getRoutes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Craude Appの環境テスト用ページ
          </h1>
          <p className="text-slate-600 mt-2">利用可能なルート一覧</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {routes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">
              ルートが見つかりません
            </h2>
            <p className="text-slate-500">
              app/配下にpage.tsxファイルを含むフォルダを作成してください
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                利用可能なページ ({routes.length})
              </h2>
              <p className="text-slate-600">
                各ページへアクセスするには、下記のリンクをクリックしてください
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routes.map((route) => (
                <Link
                  key={route.path}
                  href={route.path}
                  className="group block p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {route.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {route.description}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors ml-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>

                  <div className="flex items-center text-sm text-slate-500">
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                      {route.path}
                    </code>
                  </div>

                  {/* Hover effect indicator */}
                  <div className="mt-4 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"></div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-slate-200 bg-white/50">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>Next.js App Router • 自動生成されたルート一覧</p>
        </div>
      </footer>
    </div>
  );
}
