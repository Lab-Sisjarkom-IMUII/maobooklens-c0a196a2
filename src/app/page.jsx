"use client"; // penting kalau ada interaksi DOM

import { useEffect } from "react";
import Head from "next/head";

export default function Page() {
  useEffect(() => {
    // Registrasi service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js");
    }

    // Script MVC bisa dipanggil di sini jika perlu
    // Contoh: import module atau panggil function dari model/view/controller
  }, []);

  return (
    <>
      <Head>
        <title>BookLens</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0d6efd" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <link rel="stylesheet" href="/css/style.css" />
      </Head>

      <div id="app">
        <header className="app-header">
          <div className="brand">
            <span className="logo" aria-hidden="true"></span>
            <h1>BookLens</h1>
          </div>
          <button id="btnReset" className="link" aria-label="Keluar">
            Keluar
          </button>
        </header>

        <main id="viewRoot" className="container">
          {/* Login View akan dirender di sini */}
        </main>

        <div id="toast" role="status" aria-live="polite" className="toast hidden"></div>

        <div id="loading" className="loading hidden" aria-live="assertive" aria-busy="true">
          <div className="spinner"></div>
          <p>Menganalisis sampul buku...</p>
        </div>
      </div>
    </>
  );
}