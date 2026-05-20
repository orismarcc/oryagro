import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oryagro.app',
  appName: 'OryAgro',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#16a34a',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // adjustResize removido — não é uma opção válida do Capacitor
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#16a34a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#16a34a',
      // overlaysWebView: false (padrão) — a barra de status fica ACIMA do
      // WebView com cor sólida (#16a34a). O WebView começa abaixo dela.
      // Não é necessário env(safe-area-inset-top) no CSS.
    },
  },
};

export default config;
