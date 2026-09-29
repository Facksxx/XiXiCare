import { useState } from 'react';
import { exitWithoutConsent, openPrivacyPolicy, PRIVACY_CONSENT_KEY } from '../privacy';

export function PrivacyConsent({ onAgree }: { onAgree: () => void }) {
  const [opening, setOpening] = useState(false);

  const viewPolicy = async () => {
    setOpening(true);
    try { await openPrivacyPolicy(); }
    catch { window.alert('隐私政策暂时无法打开，请检查网络后重试。'); }
    finally { setOpening(false); }
  };

  const agree = () => {
    try {
      localStorage.setItem(PRIVACY_CONSENT_KEY, 'agreed');
      onAgree();
    } catch {
      window.alert('无法保存同意记录，请检查应用存储权限后重试。');
    }
  };

  return (
    <main className="privacy-gate">
      <section className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title" aria-describedby="privacy-description">
        <h1 id="privacy-title">隐私政策</h1>
        <p id="privacy-description">欢迎使用 XIXI CARE。使用前，请阅读隐私政策，了解个人信息的处理规则。点击“同意并继续”即表示你已阅读并同意该政策；如不同意，将退出应用。</p>
        <button type="button" className="privacy-policy-link" onClick={viewPolicy} disabled={opening}>查看完整隐私政策 ↗</button>
        <div className="privacy-actions">
          <button type="button" className="privacy-disagree" onClick={() => void exitWithoutConsent()}>不同意并退出</button>
          <button type="button" className="privacy-agree" onClick={agree}>同意并继续</button>
        </div>
      </section>
    </main>
  );
}
