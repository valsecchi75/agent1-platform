import type { Metadata } from "next";
import "./globals.css";
import { DashboardEntrance } from "@/components/DashboardEntrance";
import { Toast } from "@/components/Toast";
import { NodePackChecker } from "@/components/node-packs/NodePackChecker";
import { OnboardingWizardLoader } from "@/components/onboarding/OnboardingWizardLoader";

export const metadata: Metadata = {
  title: "AGENT 1 — From Vision to Form",
  description: "Open-source node-based platform for API-driven creative generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=Arimo:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('agent1-theme');
              var s = localStorage.getItem('agent1-skin');
              if (t === 'light' || t === 'dark') {
                document.documentElement.setAttribute('data-theme', t);
              } else {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
              if (s) {
                document.documentElement.setAttribute('data-skin', s);
              } else {
                document.documentElement.setAttribute('data-skin', 'aurora');
              }
              var nd = localStorage.getItem('agent1-node-design');
              if (nd === 'v2') document.documentElement.setAttribute('data-node-design', nd);
            } catch(e) {
              document.documentElement.setAttribute('data-theme', 'dark');
              document.documentElement.setAttribute('data-skin', 'aurora');
            }
          })();
        `}} />
      </head>
      <body className="antialiased">
        <DashboardEntrance />
        <NodePackChecker />
        {children}
        <Toast />
        <OnboardingWizardLoader />
      </body>
    </html>
  );
}
