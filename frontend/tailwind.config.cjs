/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        hero: ["40px", { lineHeight: "1.15", fontWeight: "700" }],
        title: ["28px", { lineHeight: "1.2", fontWeight: "600" }],
        section: ["21px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["17px", { lineHeight: "1.6", fontWeight: "400" }],
        body: ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        meta: ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        "meta-sm": ["11px", { lineHeight: "1.3", fontWeight: "500" }],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--canvas)",
        workspace: "var(--workspace)",
        panel: {
          DEFAULT: "var(--panel)",
          foreground: "var(--panel-foreground)",
          muted: "var(--panel-muted)",
        },
        overlay: {
          DEFAULT: "var(--overlay)",
          foreground: "var(--overlay-foreground)",
          backdrop: "var(--overlay-backdrop)",
        },
        separator: "var(--separator)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        interaction: {
          DEFAULT: "var(--interaction)",
          hover: "var(--interaction-hover)",
          muted: "var(--interaction-muted)",
          foreground: "var(--interaction-foreground)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        status: {
          draft: "var(--status-draft)",
          "draft-foreground": "var(--status-draft-foreground)",
          finalized: "var(--status-finalized)",
          "finalized-foreground": "var(--status-finalized-foreground)",
          success: "var(--status-success)",
          "success-foreground": "var(--status-success-foreground)",
          warning: "var(--status-warning)",
          "warning-foreground": "var(--status-warning-foreground)",
          danger: "var(--status-danger)",
          "danger-foreground": "var(--status-danger-foreground)",
          info: "var(--status-info)",
          "info-foreground": "var(--status-info-foreground)",
          generation: "var(--status-generation)",
          "generation-foreground": "var(--status-generation-foreground)",
          review: "var(--status-review)",
          "review-foreground": "var(--status-review-foreground)",
          "needs-input": "var(--status-needs-input)",
          "needs-input-foreground": "var(--status-needs-input-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(90deg, var(--muted) 0%, var(--surface-elevated) 50%, var(--muted) 100%)",
      },
      backgroundSize: {
        shimmer: "200% 100%",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};
