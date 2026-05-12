import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	root: 'webview-ui',
	base: '',
	build: {
		emptyOutDir: true,
		outDir: '../dist/webview',
		cssCodeSplit: false,
		rollupOptions: {
			input: 'webview-ui/index.html',
			output: {
				entryFileNames: 'assets/index.js',
				chunkFileNames: 'assets/[name].js',
				assetFileNames: assetInfo => {
					if (assetInfo.names?.some(name => name.endsWith('.css'))) {
						return 'assets/style.css';
					}

					return 'assets/[name][extname]';
				}
			}
		}
	}
});
