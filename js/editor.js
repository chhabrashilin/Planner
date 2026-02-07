/**
 * Notion-Level Planner - Rich Text Editor
 * Inline formatting, markdown shortcuts, and floating toolbar
 */

class Editor {
    constructor(app) {
        this.app = app;
        this.toolbar = null;
        this.currentSelection = null;

        this.init();
    }

    init() {
        this.toolbar = document.getElementById('formatToolbar');
        if (!this.toolbar) return;

        this.bindEvents();
        this.registerKeyboardShortcuts();
    }

    bindEvents() {
        // Selection change
        document.addEventListener('selectionchange', Utils.debounce(() => {
            this.handleSelectionChange();
        }, 100));

        // Toolbar button clicks
        this.toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.format-btn');
            if (btn) {
                e.preventDefault();
                const format = btn.dataset.format;
                this.applyFormat(format);
            }
        });

        // Hide toolbar on scroll
        document.addEventListener('scroll', () => {
            this.hideToolbar();
        }, true);

        // Hide toolbar on click outside
        document.addEventListener('mousedown', (e) => {
            if (!this.toolbar.contains(e.target) && !e.target.closest('.block-content')) {
                this.hideToolbar();
            }
        });
    }

    registerKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!e.target.closest('.block-content')) return;

            // Bold
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.applyFormat('bold');
            }

            // Italic
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.applyFormat('italic');
            }

            // Underline
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                this.applyFormat('underline');
            }

            // Strikethrough
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
                e.preventDefault();
                this.applyFormat('strikethrough');
            }

            // Inline code
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.applyFormat('code');
            }

            // Link
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                // Don't interfere with command palette
                if (!this.hasSelection()) return;
                e.preventDefault();
                this.applyFormat('link');
            }
        });

        // Markdown shortcuts on space
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && e.target.closest('.block-content')) {
                this.checkInlineMarkdown(e);
            }
        });
    }

    handleSelectionChange() {
        const selection = window.getSelection();

        if (!selection.rangeCount || selection.isCollapsed) {
            this.hideToolbar();
            return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const blockContent = container.closest ? container.closest('.block-content') :
            container.parentElement?.closest('.block-content');

        if (!blockContent) {
            this.hideToolbar();
            return;
        }

        this.currentSelection = { range, selection };
        this.showToolbar(range);
        this.updateToolbarState();
    }

    showToolbar(range) {
        const rect = range.getBoundingClientRect();

        this.toolbar.style.display = 'flex';
        this.toolbar.style.top = `${rect.top - 40}px`;
        this.toolbar.style.left = `${rect.left + (rect.width / 2)}px`;
    }

    hideToolbar() {
        this.toolbar.style.display = 'none';
        this.currentSelection = null;
    }

    updateToolbarState() {
        // Update active state of buttons
        const buttons = this.toolbar.querySelectorAll('.format-btn');

        buttons.forEach(btn => {
            const format = btn.dataset.format;
            const isActive = this.isFormatActive(format);
            btn.classList.toggle('active', isActive);
        });
    }

    isFormatActive(format) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;

        // If text node, get parent element
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        const tagMap = {
            bold: ['B', 'STRONG'],
            italic: ['I', 'EM'],
            underline: ['U'],
            strikethrough: ['S', 'STRIKE', 'DEL']
        };

        const tags = tagMap[format] || [];
        while (node && node !== document.body) {
            if (tags.includes(node.tagName)) {
                return true;
            }
            node = node.parentElement;
        }
        return false;
    }

    hasSelection() {
        const selection = window.getSelection();
        return selection.rangeCount > 0 && !selection.isCollapsed;
    }

    applyFormat(format) {
        if (!this.hasSelection()) return;

        const tagMap = {
            bold: 'strong',
            italic: 'em',
            underline: 'u',
            strikethrough: 's',
            code: 'code',
            highlight: 'mark'
        };

        switch (format) {
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strikethrough':
            case 'code':
            case 'highlight':
                this.wrapSelection(tagMap[format]);
                break;
            case 'link':
                this.insertLink();
                break;
        }

        this.updateToolbarState();
    }

    wrapSelection(tagName) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.extractContents();

        // Check if already wrapped
        const parent = range.commonAncestorContainer.parentElement;
        if (parent && parent.tagName.toLowerCase() === tagName) {
            // Unwrap
            const text = document.createTextNode(parent.textContent);
            parent.parentNode.replaceChild(text, parent);
            return;
        }

        const wrapper = document.createElement(tagName);
        wrapper.appendChild(selectedText);
        range.insertNode(wrapper);

        // Reselect
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        selection.addRange(newRange);
    }

    insertLink() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const text = range.toString();

        const url = prompt('Enter URL:', 'https://');
        if (!url) return;

        // Validate URL
        const sanitizedUrl = this.sanitizeUrl(url);
        if (!sanitizedUrl) {
            console.warn('Invalid URL provided');
            return;
        }

        const link = document.createElement('a');
        link.href = sanitizedUrl;
        link.textContent = text;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        range.deleteContents();
        range.insertNode(link);
    }

    /**
     * Sanitize URLs to prevent XSS attacks
     */
    sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();

        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return trimmed;
            }
        } catch {
            // Invalid URL
        }
        return '';
    }

    checkInlineMarkdown(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent;
        const cursorPos = range.startOffset;
        const textBefore = text.substring(0, cursorPos);

        // Check for markdown patterns
        const patterns = [
            { regex: /\*\*([^*]+)\*\*$/, format: 'bold', wrapper: 'strong' },
            { regex: /__([^_]+)__$/, format: 'bold', wrapper: 'strong' },
            { regex: /\*([^*]+)\*$/, format: 'italic', wrapper: 'em' },
            { regex: /_([^_]+)_$/, format: 'italic', wrapper: 'em' },
            { regex: /~~([^~]+)~~$/, format: 'strikethrough', wrapper: 's' },
            { regex: /`([^`]+)`$/, format: 'code', wrapper: 'code' },
            { regex: /\[([^\]]+)\]\(([^)]+)\)$/, format: 'link' }
        ];

        for (const pattern of patterns) {
            const match = textBefore.match(pattern.regex);
            if (match) {
                e.preventDefault();

                if (pattern.format === 'link') {
                    const linkText = match[1];
                    const linkUrl = match[2];

                    // Validate URL
                    const sanitizedUrl = this.sanitizeUrl(linkUrl);
                    if (!sanitizedUrl) return;

                    // Replace markdown with link
                    const beforeMatch = text.substring(0, cursorPos - match[0].length);
                    const afterMatch = text.substring(cursorPos);

                    node.textContent = beforeMatch + afterMatch;

                    const link = document.createElement('a');
                    link.href = sanitizedUrl;
                    link.textContent = linkText;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';

                    const newRange = document.createRange();
                    newRange.setStart(node, beforeMatch.length);
                    newRange.collapse(true);

                    newRange.insertNode(link);

                    // Move cursor after link
                    selection.removeAllRanges();
                    const endRange = document.createRange();
                    endRange.setStartAfter(link);
                    endRange.collapse(true);
                    selection.addRange(endRange);
                } else {
                    const content = match[1];
                    const beforeMatch = text.substring(0, cursorPos - match[0].length);
                    const afterMatch = text.substring(cursorPos);

                    node.textContent = beforeMatch + afterMatch;

                    const wrapper = document.createElement(pattern.wrapper);
                    wrapper.textContent = content;

                    const newRange = document.createRange();
                    newRange.setStart(node, beforeMatch.length);
                    newRange.collapse(true);

                    newRange.insertNode(wrapper);

                    // Move cursor after wrapper
                    selection.removeAllRanges();
                    const endRange = document.createRange();
                    endRange.setStartAfter(wrapper);
                    endRange.collapse(true);
                    selection.addRange(endRange);
                }

                return;
            }
        }
    }
}

// Export
window.Editor = Editor;
