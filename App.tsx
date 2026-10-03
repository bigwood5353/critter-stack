import { useCallback, useEffect, useRef } from 'react';
import { AppState, Linking, StyleSheet, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import CritterNative from './modules/critter-native';
import GAME_HTML from './web/game';

// The game is one web page bundled into the app. It keeps progress in localStorage, which WebKit stores per
// origin, so this address must NEVER change after release or players would lose their progress.
const ORIGIN = 'https://critterstack.app/';

// Native services the page may use (see bridge() in the game). The home-screen widget is not in this version.
const SERVICES = ['gameCenter', 'store', 'ads', 'haptics', 'notify', 'share'];
const BEFORE_LOAD = `window.__critterNative=${JSON.stringify(SERVICES)};true;`;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const bg = useColorScheme() === 'dark' ? '#150D30' : '#F2ECFF';   // matches the game's own background
  const web = useRef<WebView>(null);
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

  // Page → native
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const { name, msg } = JSON.parse(e.nativeEvent.data);
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
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style="auto" />
      <WebView
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
        // the game never navigates away; any real link opens in Safari
        onShouldStartLoadWithRequest={req => {
          if (req.url.startsWith(ORIGIN) || req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith('blob:')) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        // if iOS reclaims the page in the background, reload instead of showing a blank screen
        onContentProcessDidTerminate={() => web.current?.reload()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2ECFF' },
  web: { flex: 1, backgroundColor: '#F2ECFF' },
});
