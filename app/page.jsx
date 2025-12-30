"use client";
import { useEffect } from "react";
import Script from "next/script";

export default function Page() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
  }, []);

  return (
    <>
      <div id="app">
        <header className="app-header">
          <div className="brand">
            <span className="logo" aria-hidden="true"></span>
            <h1>BookLens</h1>
          </div>
          <button id="btnReset" className="link" aria-label="Keluar">Keluar</button>
        </header>

        <main id="viewRoot" className="container">
          {/* Login/Main/Results will be rendered by view.js */}
        </main>

        <div id="toast" role="status" aria-live="polite" className="toast hidden"></div>

        <div id="loading" className="loading hidden" aria-live="assertive" aria-busy="true">
          <div className="spinner"></div>
          <p>Menganalisis sampul buku...</p>
        </div>
      </div>

      <Script src="/js/model.js" strategy="afterInteractive" />
      <Script src="/js/view.js" strategy="afterInteractive" />
      <Script src="/js/controller.js" strategy="afterInteractive" />
    </>
  );
}
