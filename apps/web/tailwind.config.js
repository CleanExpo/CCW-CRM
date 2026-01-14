/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'ccw-navy': '#003366',
                'ccw-gold': '#FFCC00',
            },
            fontFamily: {
                sans: ['Montserrat', 'Arial', 'Helvetica', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
