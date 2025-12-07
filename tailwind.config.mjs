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
      themes: {
        light: {
          extend: {
            colors: {
              foreground: {
                DEFAULT: "var(--foreground)",
                secondary: "var(--muted-foreground)",
              },
              background: {
                DEFAULT: "var(--background)",
                secondary: "var(--secondary)",
                tertiary: "var(--border)",
              },
              border: {
                DEFAULT: "var(--border)",
              },
            },
          },
        },
        dark: {
          extend: {
            colors: {
              foreground: {
                DEFAULT: "var(--foreground)",
                secondary: "var(--muted-foreground)",
              },
              background: {
                DEFAULT: "var(--background)",
                secondary: "var(--secondary)",
                tertiary: "var(--muted)",
              },
              border: {
                DEFAULT: "var(--border)",
              },
            },
          },
        },
      },
    }),
  ],
};

export default config;
