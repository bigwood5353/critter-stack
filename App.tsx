import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Linking, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import CritterNative from './modules/critter-native';
import GAME_HTML from './web/game';

// The game is one web page bundled into the app. It keeps progress in localStorage, which WebKit stores per
// origin, so this address must NEVER change after release or players would lose their progress.
const ORIGIN = 'https://critterstack.app/';

// Native services the page may use (see bridge() in the game). The home-screen widget is not in this version.
// Android has no Game Center or iCloud: its rankings use the shared Critter Stack board ('board', run by the page
// itself) and Android's own backup keeps progress; 'app' lets the page close the app from the menu (Back button).
const ANDROID = Platform.OS === 'android';
// 'app' (both): open a store page or the phone's Settings; on Android also leave the app from the menu.
const SERVICES = ANDROID
  ? ['board', 'store', 'ads', 'haptics', 'notify', 'share', 'app']
  : ['gameCenter', 'store', 'ads', 'haptics', 'notify', 'share', 'cloud', 'app'];
const STORE_LINK = /^https:\/\/(apps\.apple\.com|play\.google\.com)\//;
const BEFORE_LOAD = `window.__critterNative=${JSON.stringify(SERVICES)};window.__critterPlatform=${JSON.stringify(Platform.OS)};true;`;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}

function Game() {
  // Android draws the app behind the status and navigation bars; keep the game clear of them.
  // (iOS keeps its edge-to-edge layout: the page uses env(safe-area-inset-*) there.)
  const insets = useSafeAreaInsets();
  const bg = useColorScheme() === 'dark' ? '#150D30' : '#F2ECFF';   // matches the game's own background
  const web = useRef<WebView>(null);
  // Loading the game again means a fresh WebView. WebKit's own reload() would fetch the page's address
  // (ORIGIN) from the internet, which isn't a real site, and shows "Error loading page".
  const [gen, setGen] = useState(0);
  const reloadGame = useCallback(() => setGen(g => g + 1), []);
  const loaded = useRef(false);
  const queue = useRef<string[]>([]);

  // Run window.<fn>(...args) in the page. Calls that arrive before the page has loaded wait in a queue.
  const callPage = useCallback((fn: string, argsJSON: string) => {
    if (!/^critter[A-Za-z]+$/.test(fn)) return;           // only the game's own callbacks
    const js = `window.${fn}&&window.${fn}(${argsJSON});true;`;
    if (loaded.current) web.current?.injectJavaScript(js);
    else queue.current.push(js);
  }, []);

  // Native → page
  useEffect(() => {
    const sub = CritterNative.addListener('critterCall', ({ fn, args }) => callPage(fn, args));
    CritterNative.start();
    return () => sub.remove();
  }, [callPage]);

  // App going to the background / coming back: the page pauses the game and saves; native retries offline scores
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      callPage('critterAppState', JSON.stringify(state));
      CritterNative.appState(state);
    });
    return () => sub.remove();
  }, [callPage]);

  // Android Back button: the page decides (close a screen, pause the game, or ask to leave from the menu)
  useEffect(() => {
    if (!ANDROID) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { callPage('critterBack', ''); return true; });
    return () => sub.remove();
  }, [callPage]);

  // Page → native
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const { name, msg } = JSON.parse(e.nativeEvent.data);
      if (name === 'app' && msg) {
        if (msg.type === 'reload') reloadGame();
      else if (msg.type === 'exit' && ANDROID) BackHandler.exitApp();
        else if (msg.type === 'openSettings') Linking.openSettings().catch(() => {});
        else if (msg.type === 'openURL' && typeof msg.url === 'string' && STORE_LINK.test(msg.url)) Linking.openURL(msg.url).catch(() => {});
        return;
      }
      if (typeof name === 'string' && msg && typeof msg.type === 'string') {
        CritterNative.handle(name, msg.type, JSON.stringify(msg));
      }
    } catch {}
  }, []);

  const onLoadEnd = useCallback(() => {
    loaded.current = true;
    queue.current.splice(0).forEach(js => web.current?.injectJavaScript(js));
    CritterNative.pageReady();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: bg },
      ANDROID && { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <StatusBar style="auto" />
      <WebView
        key={gen}
        ref={web}
        style={[styles.web, { backgroundColor: bg }]}
        source={{ html: GAME_HTML, baseUrl: ORIGIN }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        // behave like an app, not a browser
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        setSupportMultipleWindows={false}
        pullToRefreshEnabled={false}
        // sound and storage
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled
        incognito={false}
        cacheEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        webviewDebuggingEnabled={__DEV__}
        // Android: ignore the phone's font-size setting (the game sizes its own text) and keep the page in one piece
        textZoom={100}
        setBuiltInZoomControls={false}
        nestedScrollEnabled={false}
        // the game never navigates away; any real link opens in Safari
        onShouldStartLoadWithRequest={req => {
          if (req.navigationType === 'reload') { reloadGame(); return false; }   // never fetch ORIGIN from the internet
          if (req.url.startsWith(ORIGIN) || req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith('blob:')) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        // if iOS reclaims the page in the background, reload instead of showing a blank screen
        onContentProcessDidTerminate={reloadGame}
        // the same on Android, where the WebView's renderer can be stopped to free memory
        onRenderProcessGone={reloadGame}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2ECFF' },
  web: { flex: 1, backgroundColor: '#F2ECFF' },
});
