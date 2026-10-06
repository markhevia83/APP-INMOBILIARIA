import {defineConfig} from 'vite';
// The nested legacy App makes Rollup tree-shaking take minutes; minification remains enabled.
export default defineConfig({css:{postcss:{}},build:{rollupOptions:{treeshake:false,maxParallelFileOps:32}}});

