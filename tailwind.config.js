/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'editaliza-blue': '#0528f2',
        'editaliza-green': '#1ad937',
        'editaliza-black': '#0d0d0d',
        'editaliza-gray': '#969696',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
