import {
  Fira_Code as FontMono,
  Inter as FontSans,
  Commissioner,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontCommissioner = Commissioner({
  subsets: ["latin"],
  variable: "--font-commissioner",
});
