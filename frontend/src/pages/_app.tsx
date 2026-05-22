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

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider modalSize="compact">
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <GamificationProvider>
              {isAuthPage ? (
                // Auth pages: full-screen, no Navbar, no padding
                <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
                  <div className="fixed inset-0 bg-grid-pattern pointer-events-none z-0" style={{ opacity: 0.025 }} />
                  <div className="relative z-10">
                    <Component {...pageProps} />
                  </div>
                </div>
              ) : (
                // App pages: full layout with Navbar, padding, footer
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
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
