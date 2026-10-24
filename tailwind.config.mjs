import { heroui } from "@heroui/theme";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-satoshi)", "var(--font-inter)"],
        mono: ["var(--font-mono)"],
        commissioner: ["var(--font-commissioner)"],
        satoshi: ["var(--font-satoshi)", "sans-serif"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    typography,
    heroui({
      addCommonColors: true,
      themes: {
        light: {
          colors: {
            foreground: {
              DEFAULT: "#2D2B26",
              secondary: "#5C5E5E",
            },
            background: {
              DEFAULT: "#FFFFFF",
              secondary: "#F7F7F7",
              tertiary: "#DCDDDC",
            },
            border: {
              DEFAULT: "#DCDDDC",
            },
          },
        },
        dark: {
          colors: {
            foreground: {
              DEFAULT: "#F3F4F3",
              secondary: "#A0A2A2",
            },
            background: {
              DEFAULT: "#141516",
              secondary: "#1C1E1F",
              tertiary: "#2A2C2D",
            },
            border: {
              DEFAULT: "#2A2C2D",
            },
          },
        },
      },
    }),
  ],
};

export default config;
