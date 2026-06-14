/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0fbf9',
          100: '#dcf6f1',
          200: '#b9ece3',
          300: '#87dcce',
          400: '#50c2b2',
          500: '#34a697',
          600: '#268579',
          700: '#216c63',
          800: '#1e5750',
          900: '#1c4944',
          950: '#0b2a27',
        },
      },
    },
  },
  plugins: [],
}
