import {defineConfig} from 'vite';
// The nested legacy App makes Rollup tree-shaking take minutes; minification remains enabled.
export default defineConfig({css:{postcss:{}},build:{rollupOptions:{input:{app:'index.html',operations:'operations.html',privacy:'privacy.html'},treeshake:false,maxParallelFileOps:32}}});

