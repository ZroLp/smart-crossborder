import type { Config } from "tailwindcss";
import { SHADOWS } from "./lib/theme/shadows";
import { BORDER_RADIUS } from "./lib/theme/border-radius";
import { ANIMATIONS } from "./lib/theme/animation";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1677FF",
          light: "#4096FF",
          dark: "#0958D9",
        },
        success: {
          DEFAULT: "#00B42A",
          light: "#36CFC9",
        },
        warning: "#FF7D00",
        danger: "#F53F3F",
        purple: {
          DEFAULT: "#722ED1",
          light: "#9254DE",
        },
        teal: "#36CFC9",
        gray: {
          50: "#F5F7FA",
          100: "#E5E6EB",
          200: "#C9CDD4",
          300: "#A6A6A6",
          400: "#86909C",
          500: "#4E5969",
          600: "#1D2129",
        },
      },
      fontSize: {
        h1: ["18px", { lineHeight: "26px", fontWeight: "700" }],
        h2: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["14px", { lineHeight: "22px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "20px", fontWeight: "400" }],
      },
      boxShadow: {
        "card-default": SHADOWS.CARD_DEFAULT,
        "card-hover": SHADOWS.CARD_HOVER,
        "card-deep": SHADOWS.CARD_DEEP,
        modal: SHADOWS.MODAL,
        dropdown: SHADOWS.DROPDOWN,
      },
      borderRadius: {
        card: BORDER_RADIUS.CARD,
        "card-mobile": BORDER_RADIUS.CARD_MOBILE,
        button: BORDER_RADIUS.BUTTON,
        tag: BORDER_RADIUS.TAG,
        circle: BORDER_RADIUS.CIRCLE,
        input: BORDER_RADIUS.INPUT,
      },
      animation: {
        "skeleton-gradient": `skeleton-gradient ${ANIMATIONS.SKELETON_GRADIENT.duration} ${ANIMATIONS.SKELETON_GRADIENT.easing} ${ANIMATIONS.SKELETON_GRADIENT.iteration}`,
        "ai-flow": `ai-flow ${ANIMATIONS.AI_FLOW.duration} ${ANIMATIONS.AI_FLOW.easing} ${ANIMATIONS.AI_FLOW.iteration}`,
        "hover-lift": `hover-lift ${ANIMATIONS.HOVER_LIFT.duration} ${ANIMATIONS.HOVER_LIFT.easing} ${ANIMATIONS.HOVER_LIFT.iteration}`,
        "bounce-success": `bounce-success ${ANIMATIONS.BOUNCE_SUCCESS.duration} ${ANIMATIONS.BOUNCE_SUCCESS.easing} ${ANIMATIONS.BOUNCE_SUCCESS.iteration}`,
        "shake-error": `shake-error ${ANIMATIONS.SHAKE_ERROR.duration} ${ANIMATIONS.SHAKE_ERROR.easing} ${ANIMATIONS.SHAKE_ERROR.iteration}`,
        "blink-notification": `blink-notification ${ANIMATIONS.BLINK_NOTIFICATION.duration} ${ANIMATIONS.BLINK_NOTIFICATION.easing} ${ANIMATIONS.BLINK_NOTIFICATION.iteration}`,
      },
      keyframes: {
        "skeleton-gradient": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "ai-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "hover-lift": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-4px)" },
        },
        "bounce-success": {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.15)" },
          "60%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
        "shake-error": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        "blink-notification": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
