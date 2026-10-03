import { NativeModule, requireNativeModule } from 'expo';

type CritterNativeEvents = {
  /** Native asks the page to run window.<fn>(...args); args is the JSON of the argument list without brackets. */
  critterCall: (event: { fn: string; args: string }) => void;
};

declare class CritterNativeModule extends NativeModule<CritterNativeEvents> {
  /** Sets up audio, Game Center sign-in and the App Store listener. Safe to call more than once. */
  start(): void;
  /** The game page has loaded: send prices, offer an iCloud backup, start ads. */
  pageReady(): void;
  /** The app moved to "active", "background" or "inactive". */
  appState(state: string): void;
  /** A message from the page: service name (gameCenter, store, ads, haptics, notify, cloud, share), type and the full message as JSON. */
  handle(name: string, type: string, json: string): void;
}

export default requireNativeModule<CritterNativeModule>('CritterNative');
