import { Fira_Code as FontMono, Inter, Commissioner } from "next/font/google";
import localFont from "next/font/local";

// Root font variables must not eagerly preload every family and weight.
// CSS still loads the faces used by visible text, with swap fallbacks.
export const fontMono = FontMono({
  subsets: ["latin"],
  preload: false,
  variable: "--font-mono",
});

export const fontInter = Inter({
  subsets: ["latin"],
  preload: false,
  variable: "--font-inter",
});

export const fontCommissioner = Commissioner({
  subsets: ["latin"],
  preload: false,
  weight: "variable",
  axes: ["FLAR", "VOLM", "slnt"],
  variable: "--font-commissioner",
});

export const fontSatoshi = localFont({
  preload: false,
  src: [
    {
      path: "../public/fonts/Satoshi-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-LightItalic.woff2",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-MediumItalic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/fonts/Satoshi-Black.woff2",
      weight: "900",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-BlackItalic.woff2",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
