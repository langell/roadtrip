web application/stitch/projects/9559669237004155255/screens/44202694a96e4ef58c41d4f84df7642b

# Wayfarer Design System - CSS & Styling Guide

This document outlines the core visual identity for the Wayfarer app, based on the **Terra Nova** design system. Use these values to configure your Tailwind CSS theme or standard CSS stylesheets.

## 1. Color Palette

The Wayfarer palette is inspired by nature—deep forest greens, sandstone neutrals, and crisp highlights.

| Role                       | Color (Hex)           | Tailwind Class                    |
| :------------------------- | :-------------------- | :-------------------------------- |
| **Primary (Forest)**       | `#1B4332`             | `bg-[#1B4332]` / `text-[#1B4332]` |
| **Primary Light**          | `#a5d0b9`             | `bg-[#a5d0b9]` / `text-[#a5d0b9]` |
| **Background (Parchment)** | `#fafaf5`             | `bg-[#fafaf5]`                    |
| **Surface (Sandstone)**    | `#f4f4ef`             | `bg-[#f4f4ef]`                    |
| **Accent (Earth)**         | `#c1c8c2`             | `bg-[#c1c8c2]`                    |
| **Dark Text**              | `#1c1917` (Stone 900) | `text-stone-900`                  |
| **Muted Text**             | `#78716c` (Stone 500) | `text-stone-500`                  |

## 2. Typography

We use a modern, geometric sans-serif for high readability and a premium "editorial" feel.

- **Primary Font:** `Plus Jakarta Sans`
- **Secondary Font (Navigation):** `Manrope`

### Text Styles (Tailwind Example)

- **H1 (Hero):** `text-4xl font-black tracking-tight text-[#1B4332]`
- **H2 (Section):** `text-2xl font-bold text-[#1B4332]`
- **Body:** `text-base font-medium text-stone-600 leading-relaxed`
- **Caption:** `text-xs font-semibold uppercase tracking-widest text-stone-500`

## 3. Component Styles

### Primary Button

```css
.btn-primary {
  background-color: #1b4332;
  color: #ffffff;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem; /* Round 8 */
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.btn-primary:active {
  transform: scale(0.95);
}
```

### Cards

```css
.card-wayfarer {
  background-color: #ffffff;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid #f4f4ef;
}
```

### Navigation Bar

- **Background:** `#fafaf5/80` (with `backdrop-blur-xl`)
- **Border Top:** `1px solid #c1c8c2/15`
- **Icon Active:** `bg-[#1B4332] text-white rounded-xl`

## 4. Global CSS (Variable Definition)

```css
:root {
  --color-primary: #1b4332;
  --color-primary-light: #a5d0b9;
  --color-bg: #fafaf5;
  --color-surface: #f4f4ef;
  --color-text-main: #1c1917;
  --color-text-muted: #78716c;

  --radius-standard: 0.5rem;
  --radius-large: 1rem;
}
```
