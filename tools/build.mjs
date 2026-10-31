/**
 * 构建渲染进程：Rollup + Babel（纯 JS 流程，不依赖任何外部可执行文件）。
 *   node tools/build.mjs
 *
 * 产出：
 *   dist/index.html
 *   dist/assets/app.js
 *   dist/assets/app.css
 */

import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

/** 相对路径补全 .jsx / .js 后缀（Rollup 不会自己猜扩展名） */
const resolveLocal = {
  name: 'resolve-local',
  resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return null;
    const base = path.resolve(path.dirname(importer), source);
    const candidates = [base, `${base}.jsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.jsx'), path.join(base, 'index.js')];
    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch (_) {
        /* 继续找下一个 */
      }
    }
    return null;
  },
};

const bundle = await rollup({
  input: path.join(root, 'src', 'main.jsx'),
  plugins: [
    resolveLocal,
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      preventAssignment: true,
    }),
    nodeResolve({ extensions: ['.js', '.jsx'] }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.jsx'],
      exclude: '**/node_modules/**',
      presets: [['@babel/preset-react', { runtime: 'automatic', development: false }]],
    }),
  ],
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
});

await bundle.write({
  file: path.join(dist, 'assets', 'app.js'),
  format: 'iife',
  inlineDynamicImports: true,
  sourcemap: false,
});
await bundle.close();

fs.copyFileSync(path.join(root, 'src', 'styles.css'), path.join(dist, 'assets', 'app.css'));

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Linsssside</title>
    <link rel="stylesheet" href="./assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./assets/app.js"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
for (const f of fs.readdirSync(path.join(dist, 'assets'))) {
  console.log('  dist/assets/' + f, kb(fs.statSync(path.join(dist, 'assets', f)).size));
}
console.log('构建完成 →', path.relative(root, path.join(dist, 'index.html')));
