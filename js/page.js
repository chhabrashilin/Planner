/**
 * Notion-Level Planner - Page Manager
 * Page rendering, icons, covers, and page tree management
 */

class PageManager {
    constructor(app) {
        this.app = app;
        this.blockManager = null;
        this.editor = null;

        this.commonEmojis = [
            '📄', '📝', '📋', '📌', '📍', '🎯', '💡', '⭐', '🔥', '❤️',
            '✅', '☑️', '🔲', '📊', '📈', '📉', '🗂️', '📁', '📂', '🗃️',
            '📅', '📆', '🗓️', '⏰', '⏱️', '🕐', '📢', '💬', '💭', '🗨️',
            '🏠', '🏢', '🏫', '🏥', '🏦', '🛒', '🎓', '🎨', '🎵', '🎬',
            '💻', '🖥️', '📱', '💾', '🔧', '⚙️', '🔑', '🔒', '📧', '📨',
            '👤', '👥', '🙋', '💪', '🧠', '👀', '✍️', '🤝', '🎉', '🚀'
        ];

        this.init();
    }

    init() {
        this.blockManager = new BlockManager(this.app);
        this.editor = new Editor(this.app);

        this.bindEvents();

        // Listen for page changes
        this.app.events.on('navigation:pageChanged', (page) => this.loadPage(page));
    }

    bindEvents() {
        // Page title editing
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.addEventListener('input', Utils.debounce(() => {
                this.updatePageTitle(pageTitle.textContent);
            }, 500));

            pageTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Focus first block or create one
                    const firstBlock = document.querySelector('.block .block-content');
                    if (firstBlock) {
                        firstBlock.focus();
                    } else {
                        this.blockManager.createBlock('paragraph');
                    }
                }
            });
        }

        // Icon click
        const pageIcon = document.getElementById('pageIcon');
        if (pageIcon) {
            pageIcon.addEventListener('click', () => this.showEmojiPicker());
        }

        // Cover
        const changeCoverBtn = document.getElementById('changeCoverBtn');
        if (changeCoverBtn) {
            changeCoverBtn.addEventListener('click', () => this.changeCover());
        }

        // Emoji picker
        this.setupEmojiPicker();
    }

    async loadPage(page) {
        if (!page) return;

        // Update header
        document.getElementById('pageIcon').textContent = page.icon || '📄';

        const pageTitle = document.getElementById('pageTitle');
        pageTitle.textContent = page.title || '';

        // Cover
        const pageCover = document.getElementById('pageCover');
        const pageCoverImg = document.getElementById('pageCoverImg');

        if (page.cover) {
            pageCover.style.display = 'block';
            pageCoverImg.src = page.cover;
        } else {
            pageCover.style.display = 'none';
        }

        // Load blocks
        await this.blockManager.loadBlocks(page.id);

        // Update document title
        document.title = `${page.title || 'Untitled'} - Planner`;
    }

    async updatePageTitle(title) {
        const pageId = this.app.state.get('currentPage');
        if (!pageId) return;

        await this.app.data?.updatePage(pageId, { title });
        document.title = `${title || 'Untitled'} - Planner`;

        // Update sidebar
        this.app.navigation?.sidebar?.refresh();
    }

    setupEmojiPicker() {
        const modal = document.getElementById('emojiPickerModal');
        const grid = document.getElementById('emojiGrid');
        const search = document.getElementById('emojiSearch');

        if (!modal || !grid) return;

        // Populate emoji grid
        grid.innerHTML = this.commonEmojis.map(emoji =>
            `<button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
        ).join('');

        // Emoji click
        grid.addEventListener('click', async (e) => {
            const btn = e.target.closest('.emoji-btn');
            if (btn) {
                await this.setPageIcon(btn.dataset.emoji);
                this.hideEmojiPicker();
            }
        });

        // Search
        if (search) {
            search.addEventListener('input', () => {
                const query = search.value.toLowerCase();
                const buttons = grid.querySelectorAll('.emoji-btn');
                buttons.forEach(btn => {
                    // Simple filter - in a real app, you'd have emoji metadata
                    btn.style.display = 'inline-flex';
                });
            });
        }

        // Close modal
        modal.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.hideEmojiPicker());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideEmojiPicker();
        });

        // Keyboard navigation for emoji picker
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideEmojiPicker();
            }
        });
    }

    showEmojiPicker() {
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.classList.add('open');
            document.getElementById('emojiSearch')?.focus();
        }
    }

    hideEmojiPicker() {
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.classList.remove('open');
        }
    }

    async setPageIcon(emoji) {
        const pageId = this.app.state.get('currentPage');
        if (!pageId) return;

        document.getElementById('pageIcon').textContent = emoji;
        await this.app.data?.updatePage(pageId, { icon: emoji });
        this.app.navigation?.sidebar?.refresh();
    }

    async changeCover() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const pageId = this.app.state.get('currentPage');
                if (!pageId) return;

                const cover = ev.target.result;

                document.getElementById('pageCover').style.display = 'block';
                document.getElementById('pageCoverImg').src = cover;

                await this.app.data?.updatePage(pageId, { cover });
            };
            reader.readAsDataURL(file);
        };

        input.click();
    }

    async createFromTemplate(template) {
        const page = await this.app.createNewPage();
        if (!page) return;

        // Apply template
        switch (template) {
            case 'meeting-notes':
                await this.applyMeetingNotesTemplate(page.id);
                break;
            case 'project':
                await this.applyProjectTemplate(page.id);
                break;
            case 'weekly-planner':
                await this.applyWeeklyPlannerTemplate(page.id);
                break;
            case 'habit-tracker':
                await this.applyHabitTrackerTemplate(page.id);
                break;
        }

        await this.loadPage(await this.app.data?.getPage(page.id));
    }

    async applyMeetingNotesTemplate(pageId) {
        await this.app.data?.updatePage(pageId, {
            title: 'Meeting Notes',
            icon: '📝'
        });

        const blocks = [
            { type: 'heading2', content: 'Attendees' },
            { type: 'bulleted_list', content: '' },
            { type: 'heading2', content: 'Agenda' },
            { type: 'numbered_list', content: '' },
            { type: 'heading2', content: 'Discussion' },
            { type: 'paragraph', content: '' },
            { type: 'heading2', content: 'Action Items' },
            { type: 'todo', content: '' }
        ];

        for (let i = 0; i < blocks.length; i++) {
            await this.app.data?.createBlock({
                pageId,
                type: blocks[i].type,
                content: blocks[i].content,
                order: i
            });
        }
    }

    async applyProjectTemplate(pageId) {
        await this.app.data?.updatePage(pageId, {
            title: 'Project Name',
            icon: '🚀'
        });

        const blocks = [
            { type: 'callout', content: 'Project overview goes here...', properties: { emoji: '📋' } },
            { type: 'heading2', content: 'Goals' },
            { type: 'bulleted_list', content: '' },
            { type: 'heading2', content: 'Timeline' },
            { type: 'paragraph', content: '' },
            { type: 'heading2', content: 'Tasks' },
            { type: 'todo', content: '' },
            { type: 'heading2', content: 'Resources' },
            { type: 'bulleted_list', content: '' }
        ];

        for (let i = 0; i < blocks.length; i++) {
            await this.app.data?.createBlock({
                pageId,
                type: blocks[i].type,
                content: blocks[i].content,
                order: i,
                properties: blocks[i].properties || {}
            });
        }
    }

    async applyWeeklyPlannerTemplate(pageId) {
        await this.app.data?.updatePage(pageId, {
            title: 'Weekly Planner',
            icon: '📅'
        });

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const blocks = [];

        for (const day of days) {
            blocks.push({ type: 'heading2', content: day });
            blocks.push({ type: 'todo', content: '' });
        }

        for (let i = 0; i < blocks.length; i++) {
            await this.app.data?.createBlock({
                pageId,
                type: blocks[i].type,
                content: blocks[i].content,
                order: i
            });
        }
    }

    async applyHabitTrackerTemplate(pageId) {
        await this.app.data?.updatePage(pageId, {
            title: 'Habit Tracker',
            icon: '✨'
        });

        const habits = ['Exercise', 'Read', 'Meditate', 'Drink water', 'Sleep 8 hours'];
        const blocks = [
            { type: 'heading2', content: 'Daily Habits' }
        ];

        for (const habit of habits) {
            blocks.push({ type: 'todo', content: habit });
        }

        blocks.push({ type: 'divider', content: '' });
        blocks.push({ type: 'heading2', content: 'Notes' });
        blocks.push({ type: 'paragraph', content: '' });

        for (let i = 0; i < blocks.length; i++) {
            await this.app.data?.createBlock({
                pageId,
                type: blocks[i].type,
                content: blocks[i].content,
                order: i
            });
        }
    }
}

// Initialize page manager when app is ready
function initPageManager() {
    if (window.app && !window.pageManager) {
        window.pageManager = new PageManager(window.app);
        window.app.registerModule('page', window.pageManager);
    }
}

// Handle various initialization scenarios
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.app) {
            window.app.events.on('app:ready', initPageManager);
            // Also try immediately in case app:ready already fired
            initPageManager();
        }
    });
} else {
    // DOM already loaded
    if (window.app) {
        window.app.events.on('app:ready', initPageManager);
        // Also try immediately in case app:ready already fired
        initPageManager();
    }
}

// Export
window.PageManager = PageManager;
