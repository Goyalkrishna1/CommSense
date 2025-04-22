/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors for the dashboard
        dark: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d8e0',
          300: '#aeb6c4',
          400: '#828da3',
          500: '#636e87',
          600: '#4e566f',
          700: '#40465a',
          800: '#2a2f3d',
          900: '#1a1d27',
          950: '#0f1117',
        },
      },
    },
  },
  plugins: [],
}
