
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				nexus: {
					'primary-dark': '#0D0D6F',
					'primary-bright': '#3E00FF',
					'quantum-purple': '#7400B8',
					'quantum-violet': '#6930C3',
					'logic-blue': '#5390D9',
					'logic-cerulean': '#4EA8DE',
					'numeric-turquoise': '#48BFE3',
					'numeric-cyan': '#56CFE1',
					'bio-aqua': '#64DFDF',
					'bio-seafoam': '#72EFDD',
					'physical-mint': '#80FFDB',
					'physical-cyan': '#A8FFE6',
					'economic-gold': '#FFD60A',
					'economic-amber': '#FFC300',
					'alert-coral': '#FF5E5B',
					'alert-orange': '#FF9F1C'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'glow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'rotate-slow': {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(360deg)' }
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' }
				},
				'particle-float': {
					'0%, 100%': { 
						transform: 'translateY(0) translateX(0)',
						opacity: '0.3'
					},
					'50%': { 
						transform: 'translateY(-15px) translateX(5px)',
						opacity: '1'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'float': 'float 6s ease-in-out infinite',
				'glow': 'glow 3s ease-in-out infinite',
				'rotate-slow': 'rotate-slow 12s linear infinite',
				'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
				'particle-float': 'particle-float 8s ease-in-out infinite'
			},
			backgroundImage: {
				'nexus-gradient': 'linear-gradient(135deg, #0D0D6F 0%, #3E00FF 100%)',
				'quantum-gradient': 'linear-gradient(135deg, #7400B8 0%, #6930C3 100%)',
				'numeric-gradient': 'linear-gradient(135deg, #48BFE3 0%, #56CFE1 100%)',
				'bio-gradient': 'linear-gradient(135deg, #64DFDF 0%, #72EFDD 100%)',
				'physical-gradient': 'linear-gradient(135deg, #80FFDB 0%, #A8FFE6 100%)',
				'economic-gradient': 'linear-gradient(135deg, #FFD60A 0%, #FFC300 100%)',
				'alert-gradient': 'linear-gradient(135deg, #FF5E5B 0%, #FF9F1C 100%)',
				'grid-pattern': 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
				'neural-pattern': 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
