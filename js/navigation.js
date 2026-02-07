/**
 * Notion-Level Planner - Navigation Module
 * Command palette, breadcrumbs, sidebar, and routing
 */

class NavigationManager {
    constructor(app) {
        this.app = app;
        this.commandPalette = null;
        this.sidebar = null;
        this.breadcrumbs = null;

        this.init();
    }

    init() {
        this.commandPalette = new CommandPalette(this.app);
        this.sidebar = new Sidebar(this.app);
        this.breadcrumbs = new Breadcrumbs(this.app);

        // Listen for navigation events
        this.app.events.on('navigation:pageChanged', (page) => {
            this.breadcrumbs.update(page);
            this.sidebar.setActivePage(page.id);
        });
    }
}

class CommandPalette {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.commands = [];
        this.filteredCommands = [];
        this.searchQuery = '';

        this.init();
    }

    init() {
        this.createDOM();
        this.registerDefaultCommands();

        this.app.events.on('commandPalette:toggle', (isOpen) => {
            isOpen ? this.open() : this.close();
        });
    }

    createDOM() {
        const overlay = document.createElement('div');
        overlay.id = 'command-palette-overlay';
        overlay.className = 'command-palette-overlay';
        overlay.innerHTML = `
            <div class="command-palette" role="dialog" aria-label="Command palette">
                <div class="command-palette-header">
                    <i class="fas fa-search"></i>
                    <input type="text" 
                           class="command-palette-input" 
                           placeholder="Search or type a command..."
                           autocomplete="off"
                           spellcheck="false">
                </div>
                <div class="command-palette-results">
                    <div class="command-palette-section" data-section="recent">
                        <div class="command-palette-section-title">Recent</div>
                        <div class="command-palette-items"></div>
                    </div>
                    <div class="command-palette-section" data-section="actions">
                        <div class="command-palette-section-title">Actions</div>
                        <div class="command-palette-items"></div>
                    </div>
                    <div class="command-palette-section" data-section="pages">
                        <div class="command-palette-section-title">Pages</div>
                        <div class="command-palette-items"></div>
                    </div>
                </div>
                <div class="command-palette-footer">
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>↵</kbd> Select</span>
                    <span><kbd>Esc</kbd> Close</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        this.overlay = overlay;
        this.dialog = overlay.querySelector('.command-palette');
        this.input = overlay.querySelector('.command-palette-input');
        this.results = overlay.querySelector('.command-palette-results');

        // Event listeners
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        this.input.addEventListener('input', Utils.debounce(() => {
            this.search(this.input.value);
        }, 150));

        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    registerDefaultCommands() {
        this.commands = [
            {
                id: 'new-page',
                icon: 'fa-plus',
                title: 'New Page',
                description: 'Create a new page',
                category: 'actions',
                action: () => this.app.createNewPage()
            },
            {
                id: 'new-database',
                icon: 'fa-database',
                title: 'New Database',
                description: 'Create a new database',
                category: 'actions',
                action: () => this.app.createNewPage().then(p => {
                    // Mark as database
                    if (this.app.data) {
                        this.app.data.updatePage(p.id, { isDatabase: true });
                    }
                })
            },
            {
                id: 'toggle-theme',
                icon: 'fa-moon',
                title: 'Toggle Dark Mode',
                description: 'Switch between light and dark theme',
                category: 'actions',
                action: () => this.app.toggleTheme()
            },
            {
                id: 'toggle-sidebar',
                icon: 'fa-bars',
                title: 'Toggle Sidebar',
                description: 'Show or hide the sidebar',
                category: 'actions',
                action: () => this.app.toggleSidebar()
            },
            {
                id: 'export-data',
                icon: 'fa-download',
                title: 'Export Data',
                description: 'Export all data as JSON',
                category: 'actions',
                action: async () => {
                    if (this.app.data) {
                        const json = await this.app.data.exportAll();
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `planner-backup-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                }
            },
            {
                id: 'import-data',
                icon: 'fa-upload',
                title: 'Import Data',
                description: 'Import data from JSON backup',
                category: 'actions',
                action: () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (file && this.app.data) {
                            const text = await file.text();
                            await this.app.data.importAll(text);
                            window.location.reload();
                        }
                    };
                    input.click();
                }
            },
            {
                id: 'keyboard-shortcuts',
                icon: 'fa-keyboard',
                title: 'Keyboard Shortcuts',
                description: 'View all keyboard shortcuts',
                category: 'actions',
                action: () => this.showShortcuts()
            }
        ];
    }

    async search(query) {
        this.searchQuery = query.trim().toLowerCase();
        this.selectedIndex = 0;

        // Clear results
        this.results.querySelectorAll('.command-palette-items').forEach(el => el.innerHTML = '');

        if (!this.searchQuery) {
            await this.showRecent();
            this.showCommands(this.commands.slice(0, 5));
            return;
        }

        // Filter commands
        const filteredCommands = this.commands.filter(cmd =>
            cmd.title.toLowerCase().includes(this.searchQuery) ||
            cmd.description.toLowerCase().includes(this.searchQuery)
        );
        this.showCommands(filteredCommands);

        // Search pages
        if (this.app.data) {
            const pages = await this.app.data.searchPages(this.searchQuery);
            this.showPages(pages.slice(0, 10));
        }

        this.updateSelection();
    }

    async showRecent() {
        const recentIds = this.app.state.get('recentPages');
        if (!recentIds.length || !this.app.data) return;

        const container = this.results.querySelector('[data-section="recent"] .command-palette-items');

        for (const id of recentIds.slice(0, 5)) {
            const page = await this.app.data.getPage(id);
            if (page) {
                container.appendChild(this.createItem({
                    icon: page.icon || 'fa-file',
                    title: page.title,
                    description: 'Recent',
                    action: () => this.app.navigateToPage(page.id)
                }));
            }
        }
    }

    showCommands(commands) {
        const container = this.results.querySelector('[data-section="actions"] .command-palette-items');

        commands.forEach(cmd => {
            container.appendChild(this.createItem({
                icon: cmd.icon,
                title: cmd.title,
                description: cmd.description,
                action: cmd.action
            }));
        });
    }

    showPages(pages) {
        const container = this.results.querySelector('[data-section="pages"] .command-palette-items');

        pages.forEach(page => {
            container.appendChild(this.createItem({
                icon: page.icon || 'fa-file',
                title: page.title,
                description: page.isDatabase ? 'Database' : 'Page',
                action: () => this.app.navigateToPage(page.id)
            }));
        });
    }

    createItem({ icon, title, description, action }) {
        const item = document.createElement('div');
        item.className = 'command-palette-item';
        item.innerHTML = `
            <span class="command-palette-item-icon">
                ${icon.startsWith('fa-') ? `<i class="fas ${icon}"></i>` : icon}
            </span>
            <span class="command-palette-item-title">${Utils.escapeHtml(title)}</span>
            <span class="command-palette-item-description">${Utils.escapeHtml(description)}</span>
        `;

        item.addEventListener('click', () => {
            action();
            this.close();
        });

        return item;
    }

    showShortcuts() {
        const shortcuts = this.app.keyboard.getShortcuts();
        // Show in a modal or overlay
        alert(shortcuts.map(s => `${s.combo}: ${s.description}`).join('\n'));
    }

    handleKeydown(e) {
        const items = this.results.querySelectorAll('.command-palette-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (items[this.selectedIndex]) {
                    items[this.selectedIndex].click();
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    updateSelection() {
        const items = this.results.querySelectorAll('.command-palette-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
            if (index === this.selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.add('open');
        this.input.value = '';
        this.input.focus();
        this.search('');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.app.state.set('commandPaletteOpen', false);
        document.body.style.overflow = '';
    }
}

class Sidebar {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.pageTree = null;

        this.init();
    }

    init() {
        this.container = document.querySelector('.app-sidebar');
        if (!this.container) return;

        this.render();
        this.bindEvents();

        // Listen for page changes
        this.app.events.on('page:created', () => this.refresh());
        this.app.events.on('page:deleted', () => this.refresh());
        this.app.events.on('page:updated', () => this.refresh());
    }

    async render() {
        if (!this.app.data) return;

        const workspaceId = this.app.state.get('currentWorkspace');
        if (!workspaceId) return;

        const workspace = await this.app.data.getWorkspace(workspaceId);
        const pages = await this.app.data.getPages(workspaceId);
        const favorites = this.app.state.get('favorites');

        // Get favorite pages
        const favoritePages = [];
        for (const id of favorites) {
            const page = await this.app.data.getPage(id);
            if (page) favoritePages.push(page);
        }

        this.container.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-workspace">
                    <span class="sidebar-workspace-icon">${workspace?.icon || '📚'}</span>
                    <span class="sidebar-workspace-name">${Utils.escapeHtml(workspace?.name || 'Workspace')}</span>
                </div>
                <button class="sidebar-toggle" aria-label="Toggle sidebar">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </div>

            <div class="sidebar-search">
                <button class="sidebar-search-btn" aria-label="Search">
                    <i class="fas fa-search"></i>
                    <span>Quick Find</span>
                    <kbd>Ctrl+K</kbd>
                </button>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-section-header">
                    <span>Favorites</span>
                </div>
                <div class="sidebar-pages favorites-list">
                    ${favoritePages.length ? favoritePages.map(p => this.renderPageItem(p, true)).join('') :
                '<div class="sidebar-empty">No favorites yet</div>'}
                </div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-section-header">
                    <span>Private</span>
                    <button class="sidebar-add-btn" aria-label="Add page">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="sidebar-pages page-tree">
                    ${pages.length ? pages.map(p => this.renderPageItem(p)).join('') :
                '<div class="sidebar-empty">No pages yet</div>'}
                </div>
            </div>

            <div class="sidebar-footer">
                <button class="sidebar-footer-btn" data-action="new-page">
                    <i class="fas fa-plus"></i>
                    <span>New Page</span>
                </button>
                <button class="sidebar-footer-btn" data-action="templates">
                    <i class="fas fa-copy"></i>
                    <span>Templates</span>
                </button>
            </div>
        `;

        this.pageTree = this.container.querySelector('.page-tree');
    }

    renderPageItem(page, isFavorite = false) {
        const hasChildren = false; // Will be determined by checking child count
        const isDatabase = page.isDatabase;

        return `
            <div class="sidebar-page-item" data-page-id="${page.id}">
                <button class="sidebar-page-toggle ${hasChildren ? '' : 'hidden'}">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <span class="sidebar-page-icon">${page.icon || (isDatabase ? '📊' : '📄')}</span>
                <span class="sidebar-page-title">${Utils.escapeHtml(page.title)}</span>
                <div class="sidebar-page-actions">
                    <button class="sidebar-page-action" data-action="more" aria-label="More options">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.addEventListener('click', async (e) => {
            const pageItem = e.target.closest('.sidebar-page-item');
            if (pageItem && !e.target.closest('.sidebar-page-action')) {
                const pageId = pageItem.dataset.pageId;
                await this.app.navigateToPage(pageId);
            }

            const addBtn = e.target.closest('.sidebar-add-btn');
            if (addBtn) {
                await this.app.createNewPage();
                this.refresh();
            }

            const searchBtn = e.target.closest('.sidebar-search-btn');
            if (searchBtn) {
                this.app.toggleCommandPalette();
            }

            const footerBtn = e.target.closest('.sidebar-footer-btn');
            if (footerBtn) {
                const action = footerBtn.dataset.action;
                if (action === 'new-page') {
                    await this.app.createNewPage();
                    this.refresh();
                }
            }

            const toggleBtn = e.target.closest('.sidebar-toggle');
            if (toggleBtn) {
                this.app.toggleSidebar();
            }
        });
    }

    setActivePage(pageId) {
        this.container.querySelectorAll('.sidebar-page-item').forEach(item => {
            item.classList.toggle('active', item.dataset.pageId === pageId);
        });
    }

    async refresh() {
        await this.render();
        const currentPage = this.app.state.get('currentPage');
        if (currentPage) {
            this.setActivePage(currentPage);
        }
    }
}

class Breadcrumbs {
    constructor(app) {
        this.app = app;
        this.container = null;

        this.init();
    }

    init() {
        this.container = document.querySelector('.app-breadcrumbs');
    }

    async update(page) {
        if (!this.container || !page) return;

        const trail = await this.getTrail(page);

        this.container.innerHTML = trail.map((item, index) => `
            <span class="breadcrumb-item ${index === trail.length - 1 ? 'current' : ''}" 
                  data-page-id="${item.id}">
                <span class="breadcrumb-icon">${item.icon || '📄'}</span>
                <span class="breadcrumb-title">${Utils.escapeHtml(item.title)}</span>
            </span>
            ${index < trail.length - 1 ? '<i class="fas fa-chevron-right breadcrumb-separator"></i>' : ''}
        `).join('');

        // Click handlers
        this.container.querySelectorAll('.breadcrumb-item:not(.current)').forEach(item => {
            item.addEventListener('click', () => {
                this.app.navigateToPage(item.dataset.pageId);
            });
        });
    }

    async getTrail(page) {
        const trail = [page];
        let current = page;

        while (current.parentId && this.app.data) {
            const parent = await this.app.data.getPage(current.parentId);
            if (parent) {
                trail.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }

        return trail;
    }
}

// Export
window.NavigationManager = NavigationManager;
window.CommandPalette = CommandPalette;
window.Sidebar = Sidebar;
window.Breadcrumbs = Breadcrumbs;
