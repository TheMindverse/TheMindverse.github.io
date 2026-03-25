// Dark and light theme mode logic.

function themeUpdateButton() {
    const themeBtn = document.getElementById('theme-btn');

    if (themeBtn) {
        const isLight = document.body.classList.contains('light');
        themeBtn.textContent = (isLight ? '[☀]' : '[☾]');
    }
}

function themeToggle() {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    themeUpdateButton();
}

function themeWindowLoad() {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light');
    }

    themeUpdateButton();
}

window.addEventListener('DOMContentLoaded', themeWindowLoad);