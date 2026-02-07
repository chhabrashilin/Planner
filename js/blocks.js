/**
 * Notion-Level Planner - Block System
 * Content blocks with drag-and-drop, slash commands, and markdown shortcuts
 */

class BlockManager {
    constructor(app) {
        this.app = app;
        this.blocks = new Map();
        this.selectedBlocks = [];
        this.draggedBlock = null;

        this.blockTypes = this.getBlockTypes();
        this.init();
    }

    /**
     * Sanitize URLs to prevent XSS attacks
     * Only allows http, https, and data URIs for images
     */
    sanitizeUrl(url, allowDataUri = false) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();

        // Allow data URIs for images only
        if (allowDataUri && trimmed.startsWith('data:image/')) {
            return trimmed;
        }

        // Only allow http and https protocols
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

    getBlockTypes() {
        return [
            { type: 'paragraph', icon: 'fa-paragraph', name: 'Text', description: 'Just start writing with plain text', shortcut: '' },
            { type: 'heading1', icon: 'fa-heading', name: 'Heading 1', description: 'Big section heading', shortcut: '#' },
            { type: 'heading2', icon: 'fa-heading', name: 'Heading 2', description: 'Medium section heading', shortcut: '##' },
            { type: 'heading3', icon: 'fa-heading', name: 'Heading 3', description: 'Small section heading', shortcut: '###' },
            { type: 'bulleted_list', icon: 'fa-list-ul', name: 'Bulleted list', description: 'Create a simple bulleted list', shortcut: '-' },
            { type: 'numbered_list', icon: 'fa-list-ol', name: 'Numbered list', description: 'Create a list with numbering', shortcut: '1.' },
            { type: 'todo', icon: 'fa-check-square', name: 'To-do', description: 'Track tasks with a to-do list', shortcut: '[]' },
            { type: 'toggle', icon: 'fa-caret-right', name: 'Toggle', description: 'Toggles can hide and show content', shortcut: '>' },
            { type: 'quote', icon: 'fa-quote-left', name: 'Quote', description: 'Capture a quote', shortcut: '"' },
            { type: 'callout', icon: 'fa-exclamation-circle', name: 'Callout', description: 'Make writing stand out', shortcut: '' },
            { type: 'divider', icon: 'fa-minus', name: 'Divider', description: 'Visually divide blocks', shortcut: '---' },
            { type: 'code', icon: 'fa-code', name: 'Code', description: 'Capture a code snippet', shortcut: '```' },
            { type: 'image', icon: 'fa-image', name: 'Image', description: 'Upload or embed an image', shortcut: '' },
            { type: 'bookmark', icon: 'fa-bookmark', name: 'Web bookmark', description: 'Save a link as a visual bookmark', shortcut: '' },
            { type: 'table', icon: 'fa-table', name: 'Table', description: 'Add a simple table', shortcut: '' },
            { type: 'database', icon: 'fa-database', name: 'Database', description: 'Add a full database', shortcut: '' }
        ];
    }

    init() {
        this.blockMenu = new BlockMenu(this);
        this.bindEvents();
    }

    bindEvents() {
        const pageContent = document.getElementById('pageContent');
        if (!pageContent) return;

        // Handle keydown for slash commands and shortcuts
        pageContent.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Handle paste
        pageContent.addEventListener('paste', (e) => this.handlePaste(e));

        // Handle click on placeholder
        const placeholder = document.getElementById('blockPlaceholder');
        if (placeholder) {
            placeholder.addEventListener('click', () => this.createBlock('paragraph'));
        }
    }

    handleKeydown(e) {
        const block = e.target.closest('.block');
        if (!block) return;

        const blockData = this.blocks.get(block.dataset.blockId);
        if (!blockData) return;

        // Slash command
        if (e.key === '/' && e.target.textContent === '') {
            e.preventDefault();
            this.blockMenu.show(block);
            return;
        }

        // Enter key - create new block
        if (e.key === 'Enter' && !e.shiftKey) {
            const selection = window.getSelection();
            const isAtEnd = selection.focusOffset === e.target.textContent.length;

            if (isAtEnd || e.target.textContent === '') {
                e.preventDefault();
                const newBlock = this.createBlock('paragraph', null, block);
                this.focusBlock(newBlock);
                return;
            }
        }

        // Backspace on empty block - delete and focus previous
        if (e.key === 'Backspace' && e.target.textContent === '') {
            e.preventDefault();
            const prevBlock = block.previousElementSibling;
            if (prevBlock && prevBlock.classList.contains('block')) {
                this.deleteBlock(block.dataset.blockId);
                this.focusBlock(prevBlock, 'end');
            }
            return;
        }

        // Arrow up/down navigation
        if (e.key === 'ArrowUp') {
            const selection = window.getSelection();
            const isAtStart = selection.focusOffset === 0;
            if (isAtStart) {
                e.preventDefault();
                const prevBlock = block.previousElementSibling;
                if (prevBlock && prevBlock.classList.contains('block')) {
                    this.focusBlock(prevBlock, 'end');
                }
            }
        }

        if (e.key === 'ArrowDown') {
            const selection = window.getSelection();
            const isAtEnd = selection.focusOffset === e.target.textContent.length;
            if (isAtEnd) {
                e.preventDefault();
                const nextBlock = block.nextElementSibling;
                if (nextBlock && nextBlock.classList.contains('block')) {
                    this.focusBlock(nextBlock, 'start');
                }
            }
        }

        // Check for markdown shortcuts on space
        if (e.key === ' ') {
            this.checkMarkdownShortcut(e, block, blockData);
        }
    }

    checkMarkdownShortcut(e, block, blockData) {
        const content = block.querySelector('.block-content');
        if (!content) return;

        const text = content.textContent;
        const shortcuts = {
            '#': 'heading1',
            '##': 'heading2',
            '###': 'heading3',
            '-': 'bulleted_list',
            '*': 'bulleted_list',
            '1.': 'numbered_list',
            '[]': 'todo',
            '[ ]': 'todo',
            '>': 'toggle',
            '"': 'quote',
            '---': 'divider',
            '```': 'code'
        };

        for (const [shortcut, type] of Object.entries(shortcuts)) {
            if (text === shortcut) {
                e.preventDefault();
                this.convertBlock(block.dataset.blockId, type);
                content.textContent = '';
                return;
            }
        }
    }

    handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');

        // Use modern API instead of deprecated execCommand
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    async createBlock(type, content = '', afterBlock = null, options = {}) {
        const pageId = this.app.state.get('currentPage');
        if (!pageId) return null;

        // Get order
        let order = 0;
        if (afterBlock) {
            const afterBlockData = this.blocks.get(afterBlock.dataset?.blockId || afterBlock);
            order = afterBlockData ? afterBlockData.order + 1 : 0;
        } else {
            order = this.blocks.size;
        }

        // Create in database
        const blockData = await this.app.data?.createBlock({
            pageId,
            type,
            content,
            order,
            properties: options
        });

        if (!blockData) return null;

        this.blocks.set(blockData.id, blockData);

        // Create DOM element
        const blockEl = this.renderBlock(blockData);

        // Insert into DOM
        const pageContent = document.getElementById('pageContent');
        const placeholder = document.getElementById('blockPlaceholder');

        if (afterBlock && afterBlock.parentNode) {
            afterBlock.after(blockEl);
        } else if (placeholder) {
            pageContent.insertBefore(blockEl, placeholder);
        } else {
            pageContent.appendChild(blockEl);
        }

        // Hide placeholder if we have blocks
        if (placeholder && this.blocks.size > 0) {
            placeholder.style.display = 'none';
        }

        return blockEl;
    }

    renderBlock(blockData) {
        const block = document.createElement('div');
        block.className = `block block-${blockData.type}`;
        block.dataset.blockId = blockData.id;
        block.draggable = true;

        const inner = this.renderBlockContent(blockData);
        block.innerHTML = `
            <div class="block-handle" draggable="true">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="block-actions">
                <button class="block-action-btn" data-action="add" data-tooltip="Add block below">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="block-action-btn" data-action="menu" data-tooltip="More options">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
            </div>
            ${inner}
        `;

        // Bind block-specific events
        this.bindBlockEvents(block, blockData);

        return block;
    }

    renderBlockContent(blockData) {
        switch (blockData.type) {
            case 'paragraph':
                return `<div class="block-content" contenteditable="true" data-placeholder="Type '/' for commands">${Utils.escapeHtml(blockData.content)}</div>`;

            case 'heading1':
                return `<h1 class="block-content block-heading" contenteditable="true" data-placeholder="Heading 1">${Utils.escapeHtml(blockData.content)}</h1>`;

            case 'heading2':
                return `<h2 class="block-content block-heading" contenteditable="true" data-placeholder="Heading 2">${Utils.escapeHtml(blockData.content)}</h2>`;

            case 'heading3':
                return `<h3 class="block-content block-heading" contenteditable="true" data-placeholder="Heading 3">${Utils.escapeHtml(blockData.content)}</h3>`;

            case 'bulleted_list':
                return `
                    <div class="block-list-item">
                        <span class="block-bullet">•</span>
                        <div class="block-content" contenteditable="true" data-placeholder="List item">${Utils.escapeHtml(blockData.content)}</div>
                    </div>`;

            case 'numbered_list':
                return `
                    <div class="block-list-item">
                        <span class="block-number">1.</span>
                        <div class="block-content" contenteditable="true" data-placeholder="List item">${Utils.escapeHtml(blockData.content)}</div>
                    </div>`;

            case 'todo':
                const checked = blockData.properties?.checked ? 'checked' : '';
                return `
                    <div class="block-todo-item ${checked ? 'completed' : ''}">
                        <input type="checkbox" class="block-checkbox" ${checked}>
                        <div class="block-content" contenteditable="true" data-placeholder="To-do">${Utils.escapeHtml(blockData.content)}</div>
                    </div>`;

            case 'toggle':
                return `
                    <div class="block-toggle">
                        <button class="block-toggle-btn">
                            <i class="fas fa-caret-right"></i>
                        </button>
                        <div class="block-content" contenteditable="true" data-placeholder="Toggle">${Utils.escapeHtml(blockData.content)}</div>
                    </div>
                    <div class="block-toggle-content" style="display: none;">
                        <!-- Nested blocks -->
                    </div>`;

            case 'quote':
                return `<blockquote class="block-quote"><div class="block-content" contenteditable="true" data-placeholder="Empty quote">${Utils.escapeHtml(blockData.content)}</div></blockquote>`;

            case 'callout':
                const emoji = blockData.properties?.emoji || '💡';
                return `
                    <div class="block-callout">
                        <span class="block-callout-icon">${emoji}</span>
                        <div class="block-content" contenteditable="true" data-placeholder="Type something...">${Utils.escapeHtml(blockData.content)}</div>
                    </div>`;

            case 'divider':
                return `<hr class="block-divider">`;

            case 'code':
                const lang = blockData.properties?.language || 'javascript';
                return `
                    <div class="block-code">
                        <div class="block-code-header">
                            <select class="block-code-lang">
                                <option value="javascript" ${lang === 'javascript' ? 'selected' : ''}>JavaScript</option>
                                <option value="python" ${lang === 'python' ? 'selected' : ''}>Python</option>
                                <option value="html" ${lang === 'html' ? 'selected' : ''}>HTML</option>
                                <option value="css" ${lang === 'css' ? 'selected' : ''}>CSS</option>
                                <option value="sql" ${lang === 'sql' ? 'selected' : ''}>SQL</option>
                                <option value="plain" ${lang === 'plain' ? 'selected' : ''}>Plain Text</option>
                            </select>
                            <button class="block-code-copy" data-tooltip="Copy code">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <pre class="block-content block-code-content" contenteditable="true" data-placeholder="// Code">${Utils.escapeHtml(blockData.content)}</pre>
                    </div>`;

            case 'image':
                const imgSrc = this.sanitizeUrl(blockData.properties?.src || '', true);
                const imgCaption = Utils.escapeHtml(blockData.properties?.caption || '');
                return `
                    <div class="block-image">
                        ${imgSrc ? `<img src="${imgSrc}" alt="${imgCaption}">` : `
                            <div class="block-image-placeholder">
                                <i class="fas fa-image"></i>
                                <span>Add an image</span>
                                <input type="file" accept="image/*" class="block-image-input" style="display: none;">
                            </div>
                        `}
                        ${imgSrc ? `<div class="block-image-caption" contenteditable="true" data-placeholder="Add a caption">${imgCaption}</div>` : ''}
                    </div>`;

            case 'bookmark':
                const bookmarkUrl = this.sanitizeUrl(blockData.properties?.url || '');
                const bookmarkTitle = Utils.escapeHtml(blockData.properties?.title || blockData.properties?.url || '');
                const bookmarkDesc = Utils.escapeHtml(blockData.properties?.description || '');
                const bookmarkImg = this.sanitizeUrl(blockData.properties?.image || '');
                return `
                    <div class="block-bookmark ${bookmarkUrl ? 'has-url' : ''}">
                        ${bookmarkUrl ? `
                            <a href="${bookmarkUrl}" class="block-bookmark-link" target="_blank" rel="noopener noreferrer">
                                <div class="block-bookmark-content">
                                    <div class="block-bookmark-title">${bookmarkTitle}</div>
                                    <div class="block-bookmark-description">${bookmarkDesc}</div>
                                    <div class="block-bookmark-url">${Utils.escapeHtml(blockData.properties?.url || '')}</div>
                                </div>
                                ${bookmarkImg ? `<img src="${bookmarkImg}" class="block-bookmark-image" alt="">` : ''}
                            </a>
                        ` : `
                            <div class="block-bookmark-input">
                                <i class="fas fa-link"></i>
                                <input type="url" class="form-input" placeholder="Paste link...">
                            </div>
                        `}
                    </div>`;

            default:
                return `<div class="block-content" contenteditable="true">${Utils.escapeHtml(blockData.content)}</div>`;
        }
    }

    bindBlockEvents(block, blockData) {
        const content = block.querySelector('.block-content');

        // Content changes
        if (content) {
            content.addEventListener('input', Utils.debounce(() => {
                this.updateBlock(blockData.id, { content: content.textContent });
            }, 500));

            content.addEventListener('focus', () => {
                block.classList.add('focused');
            });

            content.addEventListener('blur', () => {
                block.classList.remove('focused');
            });
        }

        // Todo checkbox
        const checkbox = block.querySelector('.block-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const todoItem = block.querySelector('.block-todo-item');
                todoItem.classList.toggle('completed', checkbox.checked);
                this.updateBlock(blockData.id, {
                    properties: { ...blockData.properties, checked: checkbox.checked }
                });
            });
        }

        // Toggle
        const toggleBtn = block.querySelector('.block-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const toggleContent = block.querySelector('.block-toggle-content');
                const isOpen = toggleContent.style.display !== 'none';
                toggleContent.style.display = isOpen ? 'none' : 'block';
                toggleBtn.querySelector('i').classList.toggle('fa-caret-down', !isOpen);
                toggleBtn.querySelector('i').classList.toggle('fa-caret-right', isOpen);
            });
        }

        // Block actions
        const addBtn = block.querySelector('[data-action="add"]');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.blockMenu.show(block);
            });
        }

        // Image upload
        const imageInput = block.querySelector('.block-image-input');
        if (imageInput) {
            const placeholder = block.querySelector('.block-image-placeholder');
            placeholder?.addEventListener('click', () => imageInput.click());

            imageInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        await this.updateBlock(blockData.id, {
                            properties: { ...blockData.properties, src: ev.target.result }
                        });
                        block.querySelector('.block-image').innerHTML = `
                            <img src="${ev.target.result}" alt="">
                            <div class="block-image-caption" contenteditable="true" data-placeholder="Add a caption"></div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Drag and drop
        const handle = block.querySelector('.block-handle');
        if (handle) {
            handle.addEventListener('dragstart', (e) => {
                this.draggedBlock = block;
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            handle.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                this.draggedBlock = null;
                document.querySelectorAll('.block.drag-over').forEach(b => b.classList.remove('drag-over'));
            });
        }

        block.addEventListener('dragover', (e) => {
            if (this.draggedBlock && this.draggedBlock !== block) {
                e.preventDefault();
                block.classList.add('drag-over');
            }
        });

        block.addEventListener('dragleave', () => {
            block.classList.remove('drag-over');
        });

        block.addEventListener('drop', (e) => {
            e.preventDefault();
            block.classList.remove('drag-over');
            if (this.draggedBlock && this.draggedBlock !== block) {
                const pageContent = document.getElementById('pageContent');
                const blocks = Array.from(pageContent.querySelectorAll('.block'));
                const draggedIndex = blocks.indexOf(this.draggedBlock);
                const dropIndex = blocks.indexOf(block);

                if (draggedIndex < dropIndex) {
                    block.after(this.draggedBlock);
                } else {
                    block.before(this.draggedBlock);
                }

                this.reorderBlocks();
            }
        });
    }

    async updateBlock(id, data) {
        const blockData = this.blocks.get(id);
        if (!blockData) return;

        const updated = { ...blockData, ...data };
        this.blocks.set(id, updated);

        await this.app.data?.updateBlock(id, data);
    }

    async deleteBlock(id) {
        const block = document.querySelector(`[data-block-id="${id}"]`);
        if (block) {
            block.remove();
        }

        this.blocks.delete(id);
        await this.app.data?.deleteBlock(id);

        // Show placeholder if no blocks
        const placeholder = document.getElementById('blockPlaceholder');
        if (placeholder && this.blocks.size === 0) {
            placeholder.style.display = 'block';
        }
    }

    async convertBlock(id, newType) {
        const blockData = this.blocks.get(id);
        if (!blockData) return;

        const block = document.querySelector(`[data-block-id="${id}"]`);
        if (!block) return;

        // Update data
        blockData.type = newType;
        this.blocks.set(id, blockData);
        await this.app.data?.updateBlock(id, { type: newType });

        // Re-render
        const newBlock = this.renderBlock(blockData);
        block.replaceWith(newBlock);
        this.focusBlock(newBlock);
    }

    async reorderBlocks() {
        const pageContent = document.getElementById('pageContent');
        const blocks = Array.from(pageContent.querySelectorAll('.block'));
        const orderedIds = blocks.map(b => b.dataset.blockId);

        const pageId = this.app.state.get('currentPage');
        if (pageId) {
            await this.app.data?.reorderBlocks(pageId, orderedIds);
        }
    }

    focusBlock(block, position = 'start') {
        if (!block) return;

        const content = block.querySelector('.block-content');
        if (!content) return;

        content.focus();

        if (position === 'end' && content.textContent) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(content);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    async loadBlocks(pageId) {
        this.blocks.clear();

        const pageContent = document.getElementById('pageContent');
        const placeholder = document.getElementById('blockPlaceholder');

        // Clear existing blocks
        pageContent.querySelectorAll('.block').forEach(b => b.remove());

        const blocks = await this.app.data?.getBlocks(pageId) || [];

        if (blocks.length === 0) {
            if (placeholder) placeholder.style.display = 'block';
            return;
        }

        if (placeholder) placeholder.style.display = 'none';

        for (const blockData of blocks) {
            this.blocks.set(blockData.id, blockData);
            const blockEl = this.renderBlock(blockData);
            pageContent.insertBefore(blockEl, placeholder);
        }
    }
}

class BlockMenu {
    constructor(blockManager) {
        this.blockManager = blockManager;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.filteredTypes = [];
        this.targetBlock = null;

        this.init();
    }

    init() {
        this.menu = document.getElementById('blockMenu');
        this.itemsContainer = document.getElementById('blockMenuItems');

        if (!this.menu) return;
        this.render();
        this.bindEvents();
    }

    render() {
        this.itemsContainer.innerHTML = this.blockManager.blockTypes.map(type => `
            <div class="block-menu-item" data-type="${type.type}">
                <div class="block-menu-item-icon">
                    <i class="fas ${type.icon}"></i>
                </div>
                <div class="block-menu-item-content">
                    <div class="block-menu-item-name">${type.name}</div>
                    <div class="block-menu-item-description">${type.description}</div>
                </div>
                ${type.shortcut ? `<kbd class="block-menu-item-shortcut">${type.shortcut}</kbd>` : ''}
            </div>
        `).join('');
    }

    bindEvents() {
        // Click on menu items
        this.itemsContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.block-menu-item');
            if (item) {
                this.selectType(item.dataset.type);
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;

            if (e.key === 'Escape') {
                this.hide();
                return;
            }

            const items = this.itemsContainer.querySelectorAll('.block-menu-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection();
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection();
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const selectedItem = items[this.selectedIndex];
                if (selectedItem) {
                    this.selectType(selectedItem.dataset.type);
                }
            }
        });

        // Click outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menu.contains(e.target)) {
                this.hide();
            }
        });
    }

    show(block) {
        this.targetBlock = block;
        this.isOpen = true;
        this.selectedIndex = 0;

        // Position menu near the block
        const rect = block.getBoundingClientRect();
        this.menu.style.display = 'block';
        this.menu.style.top = `${rect.bottom + 5}px`;
        this.menu.style.left = `${rect.left}px`;

        this.updateSelection();
    }

    hide() {
        this.isOpen = false;
        this.menu.style.display = 'none';
        this.targetBlock = null;
    }

    updateSelection() {
        const items = this.itemsContainer.querySelectorAll('.block-menu-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
            if (index === this.selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    async selectType(type) {
        if (this.targetBlock) {
            const content = this.targetBlock.querySelector('.block-content');
            if (content && content.textContent === '/') {
                content.textContent = '';
            }

            // Convert existing block or create new one
            if (this.targetBlock.dataset.blockId &&
                this.targetBlock.querySelector('.block-content')?.textContent === '') {
                await this.blockManager.convertBlock(this.targetBlock.dataset.blockId, type);
            } else {
                const newBlock = await this.blockManager.createBlock(type, '', this.targetBlock);
                if (newBlock) {
                    this.blockManager.focusBlock(newBlock);
                }
            }
        }

        this.hide();
    }
}

// Export
window.BlockManager = BlockManager;
window.BlockMenu = BlockMenu;
