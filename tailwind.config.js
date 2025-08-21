import { heroui } from "@heroui/theme";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            foreground: {
              DEFAULT: "#141516",
              secondary: "#5C5E5E",
            },
            background: {
              DEFAULT: "#F6F7F6",
              secondary: "#EAECEA",
              tertiary: "#DCDDDC",
            },
            border: {
              DEFAULT: "#DCDDDC",
            },
            sidebar: {},
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

module.exports = config;
