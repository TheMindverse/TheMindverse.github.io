// Global config file.

const DEFAULT_CURRENT_YEAR = "2026";
const DEFAULT_LANDING_PAGE = "pages/landing/welcome.md";
const DEFAULT_NOT_FOUND_PAGE = "pages/landing/notfound.md";

const BLOG_CATEGORY_RAMBLES = "0"; // 🧠 Thoughts & Ramblings
const BLOG_CATEGORY_RESEARCH = "1"; // 🛰️ Terrestrial Research
const BLOG_CATEGORY_COSMIC = "2"; // 👨‍🚀 Cosmic Studies
const BLOG_CATEGORY_SPECIES = "3"; // 🛸 Species Report
const BLOG_CATEGORY_DREAMSCAPE = "4"; // 💤 Dreamscape Report
const BLOG_CATEGORY_TRIP = "5"; // 🍄 Trip Report

document.addEventListener("DOMContentLoaded", () => {
    themeInit();
    navigationInit();
});