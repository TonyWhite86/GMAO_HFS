/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./modules/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Tokens del sistema visual Pulso (ver docs/referencia-pulso/01-sistema-visual.md).
                // Cada color apunta a una CSS variable que cambia con el tema activo.
                bg: 'var(--bg)',
                surface: {
                    DEFAULT: 'var(--surface)',
                    2: 'var(--surface2)',
                    3: 'var(--surface3)',
                },
                // "border" choca con la utilidad border-*; usamos "line".
                line: {
                    DEFAULT: 'var(--border)',
                    2: 'var(--border2)',
                },
                txt: {
                    DEFAULT: 'var(--text)',
                    2: 'var(--text2)',
                    3: 'var(--text3)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    2: 'var(--accent2)',
                    dim: 'var(--accentdim)',
                    border: 'var(--accentborder)',
                },
                // Semánticos de estado (verde/ámbar/rojo/púrpura de Pulso)
                ok: {
                    DEFAULT: 'var(--green)',
                    dim: 'var(--greendim)',
                    border: 'var(--greenborder)',
                },
                warn: {
                    DEFAULT: 'var(--amber)',
                    dim: 'var(--amberdim)',
                    border: 'var(--amberborder)',
                },
                ko: {
                    DEFAULT: 'var(--red)',
                    dim: 'var(--reddim)',
                    border: 'var(--redborder)',
                },
                spec: {
                    DEFAULT: 'var(--purple)',
                    dim: 'var(--purpledim)',
                    border: 'var(--purpleborder)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Consolas', 'Courier New', 'monospace'],
            },
            boxShadow: {
                DEFAULT: 'var(--shadow)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
