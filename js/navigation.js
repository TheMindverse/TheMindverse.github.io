// Button navigation logic, as well as browser history states.

function navigationRescroll() {
    window.scrollTo({ top: 0, behavior: "instant" }); // Reset scroll to top.
}

function navigationUpdateHistory(filePath, pushHistory) {
    if (filePath) {
        if (pushHistory) {
            history.pushState({ filePath }, "", `#${filePath}`);
        } else {
            history.replaceState({ filePath }, "", `#${filePath}`);
        }
    }
}

function navigationHandleClick(navBtn, pushHistory) {
    if (navBtn && navBtn.dataset.post) {
        if (navBtn.classList) { // Update the navigation button to now be active, and remove being active from the other buttons.
            document.querySelectorAll(".nav .ascii-btn").forEach(prevBtn => prevBtn.classList.remove("active"));
            navBtn.classList.add("active");
        }

        navigationRescroll();
        navigationUpdateHistory(navBtn.dataset.post, pushHistory);
        markdownLoadFile(navBtn.dataset.post, false);
    }
}

function navigationLoadUrl(filePath, pushHistory) {
    if (filePath && filePath.endsWith(".md")) {
        const navBtn = document.querySelector(`.nav .ascii-btn[data-post="${filePath}"]`);
        if (navBtn) {
            navigationHandleClick(navBtn, pushHistory);
        } else { // Not a navigation button, try to load the actual markdown file.
            navigationRescroll();
            navigationUpdateHistory(filePath, pushHistory);
            markdownLoadFile(filePath, false);
        }
    }
}

function navigationLoadHash() {
    const windowHash = window.location.hash.slice(1); // Remove the #.
    if (windowHash && windowHash.endsWith(".md")) {
        navigationLoadUrl(windowHash, false);
    } else {
        navigationLoadUrl(DEFAULT_LANDING_PAGE, false); // Default landing page.
    }
}

function navigationInit() {
    // Setup navigation button clicks to load the landing files.
    document.querySelectorAll(".nav .ascii-btn").forEach(navBtn => {
        navBtn.addEventListener("click", () => navigationHandleClick(navBtn, true));
    });

    // Setup custom link handlers which load markdown files, they also support acting as navigation buttons.
    document.addEventListener("click", (event) => {
        const link = event.target.closest(".md-link");
        if (link && link.dataset.post) {
             event.preventDefault();
            navigationLoadUrl(link.dataset.post, true);
        }
    });

    // Setup support for forward and backwards buttons.
    window.addEventListener("popstate", (event) => {
        if (event.state && event.state.filePath) {
            navigationLoadUrl(event.state.filePath, false);
        } else {
            navigationLoadHash();
        }
    });

    navigationLoadHash(); // Load the default landing page on first visit.
}