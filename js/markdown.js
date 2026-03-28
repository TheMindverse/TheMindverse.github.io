// Markdown to html logic.

// This is my original markdown function, it works for very basic stuff, no longer used for anything.
function markdownFormatOld(md) {
    if (md) {
        // Escape HTML.
        md = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
        // Code Blocks.
        md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
            const cleaned = code.replace(/^\n/, '');
            return `<pre><code>${cleaned}</code></pre>`;
        });

        // Headers.
        md = md.replace(/^#### (.*$)/gim, '<hh>$1</hh>');
        md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        md = md.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold & Italic.
        md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        md = md.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Images.
        md = md.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

        // Custom Hyperlinks.
        md = md.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="#" class="md-link" data-post="$2">$1</a>');

        // Lists.
        md = md.replace(/^- (.*)$/gim, '<li>$1</li>');
        md = md.replace(/^\* (.*)$/gim, '<li>$1</li>');
        md = md.replace(/^\+ (.*)$/gim, '<li>$1</li>');
        md = md.replace(/((?:<li>.*?<\/li>\s*)+)/gms, '<ul>$1</ul>');

        // Line Breaks.
        md = md.replace(/\n$/gim, '<br>');
        md = md.replace(/\r$/gim, '');
    }

    return md;
}

// Convert markdown text to html text that can be rendered.
function markdownFormat(md) {
    if (!md) {
        return md;
    }

    function processInlineFormatting(text) {
        let placeholders = [];

        // Escape characters.
        text = text.replace(/\\([\\`*_\[\]()])/g, (_, char) => {
            const id = placeholders.length;
            placeholders.push(char);
            return `{{PLACEHOLDER${id}}}`;
        });

        // Inline Code.
        text = text.replace(/`([^`]+?)`/g, (_, code) => {
            const id = placeholders.length;
            placeholders.push(`<code>${code}</code>`);
            return `{{PLACEHOLDER${id}}}`;
        });

        // Images.
        text = text.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, src) => {
            const id = placeholders.length;
            placeholders.push(`<img src="${src}" alt="${alt}">`);
            return `{{PLACEHOLDER${id}}}`;
        });

        // Links.
        text = text.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (_, t, href) => {
            const id = placeholders.length;
            if (href.endsWith('.md')) {
                placeholders.push(`<a href="#" class="md-link" data-post="${href}">${t}</a>`); // Custom markdown files.
            } else {
                placeholders.push(`<a href="${href}" target="_blank" rel="noopener noreferrer">${t}</a>`); // Normal links.
            }

            return `{{PLACEHOLDER${id}}}`;
        });

        // Escape HTML.
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Bold and italic.
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Restore placeholders.
        text = text.replace(/{{PLACEHOLDER(\d+)}}/g, (_, id) => placeholders[id]);
        return text;
    }

    // Extract code blocks.
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
        const cleaned = code.replace(/^\n/, '');
        const placeholder = `{{CODEBLOCK${codeBlocks.length}}}`;
        codeBlocks.push(`<pre><code>${cleaned}</code></pre>`);
        return placeholder;
    });

    const lines = md.split(/\r?\n/);
    let result = [];
    let listBuffer = [];
    let blockquoteBuffer = [];

    function flushList() {
        if (listBuffer.length > 0) {
            result.push('<ul>' + listBuffer.join('') + '</ul>');
            listBuffer = [];
        }
    }

    function flushBlockquote() {
        if (blockquoteBuffer.length === 0) return;

        // Build nested structure.
        let html = '';
        let currentDepth = 0;

        blockquoteBuffer.forEach(({ depth, content }) => {
            while (currentDepth < depth) {
                html += '<blockquote>';
                currentDepth++;
            }

            while (currentDepth > depth) {
                html += '</blockquote>';
                currentDepth--;
            }

            // Recursively parse inner markdown.
            html += markdownFormat(content);
        });

        while (currentDepth > 0) {
            html += '</blockquote>';
            currentDepth--;
        }

        result.push(html);
        blockquoteBuffer = [];
    }

    for (let line of lines) {
        line = line.replace(/\s+$/, ''); // Trim right.

        // Empty lines.
        if (line.trim() === '') {
            if (listBuffer.length > 0) {
                flushList();
                result.push('<span class="line-break-list"></span>');
            } else {
                flushList();
                flushBlockquote();
                result.push('<span class="line-break"></span>');
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
            const indent = listMatch[1].length;
            let item = listMatch[3];
            item = processInlineFormatting(item);

            if (indent >= 2 && listBuffer.length > 0) {
                listBuffer.push(`<ul><li>${item}</li></ul>`);
            } else {
                listBuffer.push(`<li>${item}</li>`);
            }

            continue;
        } else {
            flushList();
        }

        // Headers.
        let headerMatch = line.match(/^(#{1,4})\s+(.*)/);
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
    let finalHTML = result.join('\n');
    codeBlocks.forEach((codeHTML, i) => {
        finalHTML = finalHTML.replace(`{{CODEBLOCK${i}}}`, codeHTML);
    });

    return finalHTML;
}

function markdownRender() {
    document.querySelectorAll(".post-content").forEach(element => {
        element.innerHTML = markdownFormat(element.textContent);
    });
}

function markdownDisplay(md, info, edit, title, append) {
    if (md) {
        const container = document.getElementById("content");

        const post = document.createElement("div");
        post.className = "post";

        const postInfo = document.createElement("div");
        postInfo.className = "post-info";
        postInfo.textContent = `${info}`;

        if (edit) {
            const editSpan = document.createElement("span");
            editSpan.className = "post-tooltip";
            editSpan.textContent = "*";
            editSpan.title = `Last Edited: ${edit}`;
            postInfo.appendChild(editSpan);
        }

        const postTitle = document.createElement("div");
        postTitle.className = "post-title";
        postTitle.textContent = `${title}`;

        const postContent = document.createElement("div");
        postContent.className = "md post-content";
        postContent.textContent = md;
        postContent.innerHTML = markdownFormat(md);

        post.appendChild(postInfo);
        post.appendChild(postTitle);
        post.appendChild(postContent);

        if (append) {
            container.appendChild(post);
        } else {
            container.innerHTML = "";
            container.appendChild(post);
        }

        // Small fade animation when loading posts.
        requestAnimationFrame(() => {
            post.classList.add("show");
        });
    }
}

function markdownDisplayFile(fileContents, append) {
    const fileLines = fileContents.split("\n");
    fileContents = "";

    let firstLine = true;
    let mdInfo = "";
    let mdFolder = "";
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
        } else if (line.startsWith("post-folder: ")) {
            mdFolder = line.slice(13).trim();
        } else if (line.startsWith("post-file: ")) {
            mdFile = line.slice(11).trim();
        } else if (line.startsWith("post-date: ")) {
            mdDate = line.slice(11).trim();
        } else if (line.startsWith("post-edit: ")) {
            mdEdit = line.slice(11).trim();
        } else if (line.startsWith("post-title: ")) {
            mdTitle = line.slice(12).trim();
        } else if (line.startsWith("blog-category: ")) {
            mdBlogCat = line.slice(15);
        } else if (!line.startsWith("post-") && !line.startsWith("blog-") && !line.startsWith("dimension-")) {                
            if (firstLine) {
                firstLine = false;
                if (!line.trim()) { // Skip over the first line, I put a blank line after the custom post fields as a buffer.
                    continue;
                }
            }

            fileContents += (line + "\n");
        }
    }

    if (fileContents.length > 1) {
        if (mdFolder) {
            mdInfo = mdFolder;
        }

        if (mdFile) {
            if (mdInfo) { mdInfo += " / "; }
            mdInfo += mdFile;
        }

        if (mdDate) {
            if (mdInfo) { mdInfo += " / "; }
            mdInfo += mdDate;
        }

        if (mdBlogCat) {
            mdTitle += (" / " + mdBlogCat);
        }

        if (mdInfo.endsWith(" / ")) {
            mdInfo = mdInfo.slice(0, (mdInfo.length - 3));
        }

        markdownDisplay(fileContents.slice(0, -1), mdInfo, mdEdit, mdTitle, append); // Slice to remove the last new line added when rebuilding the string.
        return true;
    }
}

async function markdownLoadFile(filePath, append) {
    if (filePath) {
        try {
            const res = await fetch(filePath);
            if (!res.ok) {
                throw new Error("File path not found.");
            }

            const text = await res.text();
            if (!text.trim()) {
                throw new Error("Empty file contents.");
            }

            if (!markdownDisplayFile(text, append)) {
                throw new Error("Failed to load file.");
            }       
        } catch (err) {
            const res = await fetch("pages/landing/notfound.md"); // Fallback if a file or page wasn't found.
            if (res.ok) {
                const text = await res.text();
                markdownDisplayFile(text, append);
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

This is a [link](https://www.google.com/).

- This is a dash list.
* This is an asterisk list.
+ This is a plus list.

- This is another dash list.
  - This is an inline dash list.

> This is a blockquote.
>> This is a nested blockquote.
> - This is a list in a blockquote.
> This is another blockquote.

This is \`code word\`

\`\`\`
This is a codeblock.
This is another codeblock.
\`\`\`

![](https://markdown-here.com/img/icon256.png)
`;

    let mdInfo = "Test / Test.html / January 1st, 1969"; 
    let mdEdit = "";
    let mdTitle = "Markdown Demo";

    markdownDisplay(md, mdInfo, mdEdit, mdTitle, true);
}