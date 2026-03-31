// Dark and light mode logic.

function themeUpdateButton() {
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
        const isLight = document.body.classList.contains("light");
        themeBtn.textContent = (isLight ? "☀" : "☾");
    }
}

function themeToggle() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem("theme", (isLight ? "light" : "dark"));
    themeUpdateButton();
}

function themeInit() {
    themeUpdateButton();
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
        themeBtn.addEventListener("click", themeToggle);
    }
}