import { Capacitor, registerPlugin } from '@capacitor/core';

export const PRIVACY_POLICY_URL = 'https://swsdl.vivo.com.cn/appstore/developer/privacy-policy/6febf0ab5b07441497d22be1c53f248c.html';
export const PRIVACY_CONSENT_KEY = 'xixicare_privacy_consent_v1';

interface PrivacyActionsPlugin {
  openPolicy(): Promise<void>;
  exitApp(): Promise<void>;
}

const PrivacyActions = registerPlugin<PrivacyActionsPlugin>('PrivacyActions');

export function openPrivacyPolicy() {
  if (Capacitor.isNativePlatform()) return PrivacyActions.openPolicy();
  window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer');
  return Promise.resolve();
}

export function exitWithoutConsent() {
  if (Capacitor.isNativePlatform()) return PrivacyActions.exitApp();
  window.close();
  return Promise.resolve();
}
