import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agenda tu asesoría | Cris Tributario",
  description: "Agenda tu asesoría tributaria inmobiliaria con Cris Tributario.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f2a44",
};

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {PIXEL_ID && /^\d+$/.test(PIXEL_ID) ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        ) : null}
        {children}
      </body>
    </html>
  );
}
