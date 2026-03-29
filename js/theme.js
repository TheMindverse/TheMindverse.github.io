// Dark and light mode logic.

function themeUpdateButton() {
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        const isLight = document.body.classList.contains('light');
        themeBtn.textContent = (isLight ? '[☀]' : '[☾]');
    }
}

function themeToggle() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('theme', (isLight ? 'light' : 'dark'));
    themeUpdateButton();
}

function themeWindowLoad() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.add("light");
    } else {
        document.body.classList.remove("light");
    }

    themeUpdateButton();
}

window.addEventListener('DOMContentLoaded', themeWindowLoad);