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
            background: {
              DEFAULT: "#F6F7F6",
              secondary: "#EAECEA",
            },
          },
        },
        dark: {
          colors: {
            background: {
              DEFAULT: "#141516",
              secondary: "#1C1E1F",
            },
          },
        },
      },
    }),
  ],
};

module.exports = config;
