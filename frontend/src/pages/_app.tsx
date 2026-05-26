import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { config } from "../wagmi";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { GamificationProvider } from "../hooks/useGamification";
import { GamificationToasts } from "../components/gamification";

const client = new QueryClient();

// Pages that render full-screen without the Navbar/footer/padding wrapper
const AUTH_ROUTES = new Set(["/login", "/register"]);

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAuthPage = AUTH_ROUTES.has(router.pathname);

  // Suppress known WalletConnect sign-client race condition errors that can
  // surface as unhandled promise rejections like:
  // "Missing or invalid. Record was recently deleted - session: <id>"
  // These originate inside @walletconnect/sign-client when a stale session
  // record was removed concurrently; we swallow and log them to avoid
  // crashing the React error overlay in development.
  React.useEffect(() => {
    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      try {
        const reason = ev.reason;
        const msg = typeof reason === 'string' ? reason : reason?.message || '';
        if (msg && msg.includes('Record was recently deleted') && msg.includes('session:')) {
          // Prevent the dev overlay / unhandled rejection from interrupting the app
          console.warn('[PumpX] Suppressed WalletConnect stale-session error:', msg);
          ev.preventDefault();
        }
      } catch (e) {
        /* ignore */
      }
    };

    const onWindowError = (ev: ErrorEvent) => {
      try {
        const msg = ev.error?.message || ev.message || '';
        if (msg && msg.includes('Record was recently deleted') && msg.includes('session:')) {
          console.warn('[PumpX] Suppressed WalletConnect stale-session error (window.error):', msg);
          ev.preventDefault();
        }
      } catch (e) {
        /* ignore */
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection as any);
    window.addEventListener('error', onWindowError as any);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection as any);
      window.removeEventListener('error', onWindowError as any);
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      <WagmiProvider config={config}>
        <RainbowKitProvider modalSize="compact">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <GamificationProvider>
            {isAuthPage ? (
              <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
                <div className="fixed inset-0 bg-grid-pattern pointer-events-none z-0" style={{ opacity: 0.025 }} />
                <div className="relative z-10">
                  <Component {...pageProps} />
                </div>
              </div>
            ) : (
              <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
                <div className="fixed inset-0 bg-grid-pattern pointer-events-none z-0" style={{ opacity: 0.025 }} />
                <GamificationToasts />
                <div className="relative z-10 flex flex-col min-h-screen">
                  <Navbar />
                  <main className="flex-1">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <Component {...pageProps} />
                    </div>
                  </main>
                  <Footer />
                </div>
              </div>
            )}
          </GamificationProvider>
        </LocalizationProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default MyApp;
