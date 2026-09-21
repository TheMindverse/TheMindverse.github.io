// Markdown to html logic.

// Convert markdown text to html text that can be rendered.
function markdownFormat(md) {
    if (!md) {
        return md;
    }

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function decodeHTML(str) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = String(str);
        return textarea.value;
    }

    // Validate a URL before putting it into an HTML attribute.
    // Only allow normal web/mail/telephone links and relative URLs.
    function sanitizeLinkUrl(rawUrl) {
        const decodedUrl = decodeHTML(rawUrl).trim();

        if (!decodedUrl) {
            return null;
        }

        try {
            const parsedUrl = new URL(decodedUrl, document.baseURI);
            const protocol = parsedUrl.protocol.toLowerCase();

            if (!["http:", "https:", "mailto:", "tel:"].includes(protocol)) {
                return null;
            }

            return decodedUrl;
        } catch (err) {
            return null;
        }
    }

    // Images intentionally have a smaller allow-list than normal links.
    function sanitizeImageUrl(rawUrl) {
        const decodedUrl = decodeHTML(rawUrl).trim();

        if (!decodedUrl) {
            return null;
        }

        try {
            const parsedUrl = new URL(decodedUrl, document.baseURI);
            const protocol = parsedUrl.protocol.toLowerCase();

            if (!["http:", "https:"].includes(protocol)) {
                return null;
            }

            return decodedUrl;
        } catch (err) {
            return null;
        }
    }

    // Return a normalized path when a link points to a same-origin Markdown file.
    // External .md links are left as normal external links.
    function getInternalMarkdownPath(rawUrl) {
        const decodedUrl = decodeHTML(rawUrl).trim();

        if (!decodedUrl) {
            return null;
        }

        try {
            const parsedUrl = new URL(decodedUrl, document.baseURI);

            if (parsedUrl.origin !== window.location.origin) {
                return null;
            }

            if (!parsedUrl.pathname.toLowerCase().endsWith(".md")) {
                return null;
            }

            // The navigation.js functions expect a markdown file path without a leading slash.
            return parsedUrl.pathname.replace(/^\/+/, "");
        } catch (err) {
            return null;
        }
    }

    // Use a unique token for placeholders so user content is extremely unlikely to collide with the temporary values used while parsing.
    const placeholderToken = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    function makePlaceholder(type, id) {
        return `__MD_${placeholderToken}_${type}_${id}__`;
    }

    function processInlineFormatting(text) {
        text = escapeHTML(text);
        const placeholders = [];

        // Escape characters.
        text = text.replace(/\\([\\`*_\[\]()])/g, (_, char) => {
            const id = placeholders.length;
            placeholders.push(char);
            return makePlaceholder("INLINE", id);
        });

        // Inline Code.
        text = text.replace(/`([^`]+?)`/g, (_, code) => {
            const id = placeholders.length;
            placeholders.push(`<code>${code}</code>`);
            return makePlaceholder("INLINE", id);
        });

        // Images.
        text = text.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, src) => {
            const id = placeholders.length;
            const safeSrc = sanitizeImageUrl(src);

            if (safeSrc) {
                placeholders.push(
                    `<img src="${escapeHTML(safeSrc)}" alt="${alt}">`
                );
            } else {
                // Remove an unsafe image URL but preserve the alt text.
                placeholders.push(alt);
            }

            return makePlaceholder("INLINE", id);
        });

        // Links.
        text = text.replace(/\[([^\]]+)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g, (_, t, href) => {
            const id = placeholders.length;
            const safeHref = sanitizeLinkUrl(href);
            const internalPath = getInternalMarkdownPath(href);

            // Prevent javascript:, data:, vbscript:, and other unsupported schemes.
            if (!safeHref) {
                placeholders.push(t);
            } else if (internalPath) {
                // Keep the real href so the link still has a useful fallback if JavaScript is unavailable, while navigation.js intercepts it.
                const escapedPath = escapeHTML(internalPath);
                placeholders.push(
                    `<a href="${escapedPath}" class="md-link" data-post="${escapedPath}">${t}</a>`
                );
            } else {
                placeholders.push(
                    `<a href="${escapeHTML(safeHref)}" target="_blank" rel="noopener noreferrer">${t}</a>`
                );
            }

            return makePlaceholder("INLINE", id);
        });

        // Bold and italic.
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
        text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\*(?!\*)([^*]+?)\*(?!\*)/g, "<em>$1</em>");

        // Restore only placeholders generated by this parser invocation.
        const escapedPlaceholderToken = placeholderToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const inlinePlaceholderRegex = new RegExp(`__MD_${escapedPlaceholderToken}_INLINE_(\\d+)__`, "g");
        text = text.replace(inlinePlaceholderRegex, (placeholder, id) => {
            return placeholders[Number(id)] ?? placeholder;
        });

        return text;
    }

    // Extract code blocks.
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
        const cleaned = code.replace(/^\n/, "");
        const placeholder = makePlaceholder("CODE", codeBlocks.length);
        codeBlocks.push(`<pre><code>${escapeHTML(cleaned)}</code></pre>`);
        return placeholder;
    });

    const lines = md.split(/\r?\n/);
    const result = [];
    const listItems = [];
    const blockquoteBuffer = [];

    function renderListItems(items) {
        const roots = [];
        const stack = [];

        for (const item of items) {
            let level = Math.floor(item.indent / 2);

            if (level < 0) {
                level = 0;
            }

            // Don't create empty intermediate list levels if indentation jumps.
            if (level > stack.length) {
                level = stack.length;
            }

            stack.length = level;

            const node = {
                content: item.content,
                children: []
            };

            if (level === 0) {
                roots.push(node);
            } else {
                stack[level - 1].children.push(node);
            }

            stack[level] = node;
        }

        function renderNodes(nodes) {
            let html = "<ul>";

            for (const node of nodes) {
                html += `<li>${node.content}`;

                if (node.children.length > 0) {
                    html += renderNodes(node.children);
                }

                html += "</li>";
            }

            html += "</ul>";
            return html;
        }

        return renderNodes(roots);
    }

    function flushList() {
        if (listItems.length > 0) {
            result.push(renderListItems(listItems));
            listItems.length = 0;
        }
    }

    function isCodeBlockPlaceholder(content) {
        return codeBlocks.some((_, i) => content === makePlaceholder("CODE", i));
    }

    function flushBlockquote() {
        if (blockquoteBuffer.length > 0) {
            // Build nested structure.
            let html = "";
            let currentDepth = 0;

            blockquoteBuffer.forEach(({ depth, content }) => {
                while (currentDepth < depth) {
                    html += "<blockquote>";
                    currentDepth++;
                }

                while (currentDepth > depth) {
                    html += "</blockquote>";
                    currentDepth--;
                }

                if (isCodeBlockPlaceholder(content)) {
                    html += content;
                } else {
                    html += `<div>${markdownFormat(content)}</div>`;
                }
            });

            while (currentDepth > 0) {
                html += "</blockquote>";
                currentDepth--;
            }

            result.push(html);
            blockquoteBuffer.length = 0;
        }
    }

    for (let line of lines) {
        line = line.replace(/\s+$/, ""); // Trim right.

        // Empty lines.
        if (!line.trim()) {
            if (listItems.length > 0) {
                flushList();
                result.push("<span class=\"line-break-list\"></span>");
            } else {
                flushList();
                flushBlockquote();
                result.push("<span class=\"line-break\"></span>");
            }

            continue;
        }

        // Blockquotes.
        const blockquoteMatch = line.match(/^(>+)\s?(.*)/);
        if (blockquoteMatch) {
            flushList();
            const depth = blockquoteMatch[1].length;
            const content = blockquoteMatch[2];
            blockquoteBuffer.push({ depth, content });
            continue;
        } else {
            flushBlockquote();
        }

        // Lists.
        const listMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
        if (listMatch) {
            flushBlockquote();

            const indent = listMatch[1].length;
            const content = processInlineFormatting(listMatch[3]);

            listItems.push({
                indent,
                content
            });

            continue;
        } else {
            flushList();
        }

        // Headers.
        const headerMatch = line.match(/^(#{1,4})\s+(.*)/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const headerText = processInlineFormatting(headerMatch[2]);
            result.push(`<h${level}>${headerText}</h${level}>`);
            continue;
        }

        // Normal text.
        result.push(processInlineFormatting(line));
    }

    flushList();
    flushBlockquote();

    // Re-insert code blocks.
    let finalHTML = result.join("\n");
    codeBlocks.forEach((codeHTML, i) => {
        finalHTML = finalHTML.replaceAll(makePlaceholder("CODE", i), codeHTML);
    });

    return finalHTML;
}

function markdownPost(markdown, fileDir, postDate, editDate, postTitle, titleAfter, append) {
    if (markdown && fileDir && postDate && postTitle) {
        const postElement = document.createElement("div");
        postElement.className = "post";

        const dirElement = document.createElement("div");
        dirElement.className = "post-dir";
        dirElement.textContent = `${fileDir}`;

        let dateShort = postDate;

        // Shorten the date so it displays better on mobile, and make it look a little less cluttered.
        if ((postDate.length > 6) && postDate.includes(" ")) {
            dateShort = (postDate.slice(0, 3) + postDate.slice(postDate.indexOf(" ")));
        }

        const dateElement = document.createElement("div");
        dateElement.className = "post-date";
        dateElement.textContent = dateShort;

        if (postDate.length > 3) {
            const editElement = document.createElement("span");
            editElement.className = "post-tip";
            editElement.textContent = "*";
            editElement.title = `Posted: ${postDate}\nLast Edited: ${editDate ? editDate : postDate}`;
            dateElement.appendChild(editElement);
        }

        const titleElement = document.createElement("div");
        titleElement.className = "post-title";
        titleElement.textContent = `${postTitle}`;

        if (titleAfter) {
            titleElement.dataset.after = titleAfter;
        }

        const markdownElement = document.createElement("div");
        markdownElement.className = "md post-content";
        markdownElement.textContent = "Loading...";
        markdownElement.innerHTML = markdownFormat(markdown);

        postElement.appendChild(dirElement); // Tab, folder, file name, etc...
        postElement.appendChild(dateElement); // Post date and when was last edited.
        postElement.appendChild(titleElement); // Title of the post.
        postElement.appendChild(markdownElement); // Actual html content of the file formatted from markdown.

        const container = document.getElementById("content");

        if (!append) {
            container.innerHTML = "";
        }

        container.appendChild(postElement);

        // Small fade animation when loading posts.
        requestAnimationFrame(() => {
            postElement.classList.add("show");
        });
    }
}

async function markdownPostFile(fileContents, append) {
    if (fileContents.trim()) {
        const fileLines = fileContents.split("\n");
        fileContents = "";

        let readHeader = false;
        let mdDir = "";
        let mdFile = "";
        let mdDate = "";
        let mdEdit = "";
        let mdTitle = "";
        let mdBlogCat = "";

        for (let line of fileLines) {
            if (line.startsWith("post-loadable: ")) {
                if (line.slice(15).trim() != "true") {
                    return false;
                }
            } else if (line.startsWith("post-load-file: ") && line.includes(".md")) {
                await markdownLoadFile(line.slice(16).trim(), false);
                append = true;
            } else if (line.startsWith("post-append-file: ") && line.includes(".md")) {
                await markdownLoadFile(line.slice(18).trim(), true);
                append = true;
            } else if (line.startsWith("post-load-archive: ") && line.includes(".md")) {
                await markdownLoadArchive(line.slice(19).trim());
                append = true;
            } else if (line.startsWith("post-dir: ")) {
                mdDir = line.slice(10).trim();
            } else if (line.startsWith("post-file: ")) {
                mdFile = line.slice(11).trim();
            } else if (line.startsWith("post-date: ")) {
                mdDate = line.slice(11).trim();
            } else if (line.startsWith("post-edit: ")) {
                mdEdit = line.slice(11).trim();
            } else if (line.startsWith("post-title: ")) {
                mdTitle = line.slice(12).trim();
            } else if (line.startsWith("blog-category: ")) {
                mdBlogCat = line.slice(15).trim();
            } else if (!line.startsWith("post-") && !line.startsWith("blog-")) {      
                if (!readHeader) {
                    if (line.trim()) {
                        readHeader = true;
                    } else {
                        continue; // Skip over blank lines between the header and the actual markdown content.
                    }
                }
                
                fileContents += (line + "\n");
            }
        }

        if (mdTitle && fileContents) {
            fileContents = fileContents.slice(0, -1); // Remove trailing new line that was added when rebuilding the markdown string.

            if (mdFile) {
                if (mdDir) { mdDir += " / "; }
                mdDir += mdFile;
            }

            if (mdDir.endsWith(" / ")) {
                mdDir = mdDir.slice(0, -3); // Remove trailing slash if there is one.
            }

            if (mdBlogCat) {
                if (mdBlogCat === BLOG_CATEGORY_RAMBLES) {
                    mdTitle = ("🧠 " + mdTitle);
                    mdBlogCat = ("/ Thoughts & Ramblings");
                } else if (mdBlogCat === BLOG_CATEGORY_RESEARCH) {
                    mdTitle = ("🛰️ " + mdTitle);
                    mdBlogCat = ("/ Terrestrial Research");
                } else if (mdBlogCat === BLOG_CATEGORY_COSMIC) {
                    mdTitle = ("👨‍🚀 " + mdTitle);
                    mdBlogCat = ("/ Cosmic Studies");
                } else if (mdBlogCat === BLOG_CATEGORY_SPECIES) {
                    mdTitle = ("🛸 " + mdTitle);
                    mdBlogCat = ("/ Species Report");
                } else if (mdBlogCat === BLOG_CATEGORY_DREAMSCAPE) {
                    mdTitle = ("💤 " + mdTitle);
                    mdBlogCat = ("/ Dreamscape Report");
                } else if (mdBlogCat === BLOG_CATEGORY_TRIP) {
                    mdTitle = ("🍄 " + mdTitle);
                    mdBlogCat = ("/ Trip Report");
                }
            }

            markdownPost(fileContents, mdDir, mdDate, mdEdit, mdTitle, mdBlogCat, append);
            return true;
        }
    }

    return false;
}

async function markdownLoadFile(filePath, append) {
    if (filePath.trim()) {
        try {
            const fileText = await fetchText(filePath);
            if (!await markdownPostFile(fileText, append)) {
                throw new Error("Failed to post markdown file.");
            }

            return true;
        } catch (err) {
            const fallbackText = await fetchText(DEFAULT_NOT_FOUND_PAGE);
            await markdownPostFile(fallbackText, append);
        }
    }

    return false;
}

async function markdownLoadArchive(filePath) {
    if (filePath.endsWith("archive.md")) {
        try {
            const fileText = await fetchText(filePath);
            const linkRegex = /\[[^\]]*\]\(\s*([^)\s]+\.md)\s*\)/gi;
            const markdownFiles = [];

            let match;
            while ((match = linkRegex.exec(fileText)) !== null) {
                if (!match[1].includes("discord")) { // Skip over discord events.
                    markdownFiles.push(match[1]);
                }
            }

            let firstFile = false; // This is just to clear any previously loaded post before we start loading the new files.

            for (const markdownFile of markdownFiles) {
                try {
                    await markdownLoadFile(markdownFile, firstFile);
                    firstFile = true;
                } catch (err) {
                    console.error(`Failed to load archive file: ${markdownFile}`, err);
                }
            }

            return true;
        } catch (err) {
            console.error(`Failed to load markdown archive: ${filePath}`, err);
            return false;
        }
    }

    return false;
}

async function fetchText(filePath, signal) {
    if (filePath.trim()) {
        const url = new URL(filePath, document.baseURI);

        if (url.origin !== window.location.origin) {
            throw new Error(`Blocked cross-origin request: ${url.href}`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const abortHandler = () => controller.abort();

        if (signal) {
            signal.addEventListener("abort", abortHandler, { once: true });
        }

        try {
            const res = await fetch(url.href, { signal: controller.signal });
            if (!res.ok) {
                throw new Error(`Failed to fetch file: ${filePath}`);
            }

            const fileText = await res.text();
            if (!fileText.trim()) {
                throw new Error(`Empty file contents: ${filePath}`);
            }

            return fileText;
        } catch (err) {
            if (err.name === "AbortError") {
                throw new Error(`Request timed out or was cancelled: ${filePath}`, { cause: err });
            }

            throw err;
        } finally {
            clearTimeout(timeout);

            if (signal) {
                signal.removeEventListener("abort", abortHandler);
            }
        }
    }
}

function markdownDemo() {
    let md =
`
# H1 Test
## H2 Test
### H3 Test
#### H4 Test

# [H1 With Links](https://www.google.com/)

This is a paragraph.

**This is a bold paragraph.**

*This is an italic paragraph.*

This is **also bold**, but \\*\\*this one isn't\\*\\*.

This is an *italic **bold*** test.

This is *another*italic word*test* ***bold italic*** a *b* *c*.

This is a [link](https://www.google.com/).

This is [another link](https://google.com/test(1))

- This is a dash list.
* This is an asterisk list.
+ This is a plus list.

- This is another dash list.
  - This is an inline dash list.
    - This is an even deeper inline dash list.
- Woo wee yippie another dash list right after.

> This is a blockquote.
>> This is a nested blockquote.
> - This is a list in a blockquote.
> **This is bold text in a blockquote.**
> This is another blockquote.
This is a line.

This is \`code word\`

\`\`\`
This is a codeblock.
This is another codeblock.
\`\`\`

![](https://markdown-here.com/img/icon256.png)
`;

    let mdInfo = "Test / Test.html"; 
    let mdDate = "January 1st, 2077";
    let mdEdit = "January 2nd, 2077";
    let mdTitle = "Markdown Demo";

    markdownPost(md, mdInfo, mdDate, mdEdit, mdTitle, "", true);
}