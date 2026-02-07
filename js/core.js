/**
 * Notion-Level Planner - Core Module
 * State management, event bus, and application utilities
 */

class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
    }

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(callback => callback(data));
    }
}

class AppState {
    constructor() {
        this.state = {
            theme: this.safeGetItem('planner-theme', 'dark'),
            sidebarCollapsed: false,
            currentWorkspace: null,
            currentPage: null,
            selectedBlocks: [],
            commandPaletteOpen: false,
            searchQuery: '',
            recentPages: this.safeParseJSON('planner-recent', []),
            favorites: this.safeParseJSON('planner-favorites', [])
        };
        this.listeners = new Map();
    }

    safeGetItem(key, defaultValue) {
        try {
            return localStorage.getItem(key) || defaultValue;
        } catch {
            return defaultValue;
        }
    }

    safeParseJSON(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return defaultValue;
            const parsed = JSON.parse(item);
            return Array.isArray(parsed) ? parsed : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    get(key) {
        return key ? this.state[key] : { ...this.state };
    }

    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;

        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(cb => cb(value, oldValue));
        }

        // Persist specific keys
        if (['theme', 'recentPages', 'favorites'].includes(key)) {
            const storageKey = `planner-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            localStorage.setItem(storageKey, typeof value === 'string' ? value : JSON.stringify(value));
        }
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        };
    }

    addRecentPage(pageId) {
        const recent = this.state.recentPages.filter(id => id !== pageId);
        recent.unshift(pageId);
        this.set('recentPages', recent.slice(0, 10));
    }

    toggleFavorite(pageId) {
        const favorites = [...this.state.favorites];
        const index = favorites.indexOf(pageId);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(pageId);
        }
        this.set('favorites', favorites);
    }

    isFavorite(pageId) {
        return this.state.favorites.includes(pageId);
    }
}

class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.registerDefaults();
    }

    register(combo, callback, description = '') {
        this.shortcuts.set(combo.toLowerCase(), { callback, description });
    }

    unregister(combo) {
        this.shortcuts.delete(combo.toLowerCase());
    }

    registerDefaults() {
        // Command palette
        this.register('ctrl+k', () => this.app.toggleCommandPalette(), 'Open command palette');
        this.register('meta+k', () => this.app.toggleCommandPalette(), 'Open command palette');

        // Navigation
        this.register('ctrl+\\', () => this.app.toggleSidebar(), 'Toggle sidebar');
        this.register('meta+\\', () => this.app.toggleSidebar(), 'Toggle sidebar');

        // Quick actions
        this.register('ctrl+n', () => this.app.createNewPage(), 'Create new page');
        this.register('meta+n', () => this.app.createNewPage(), 'Create new page');

        // Theme toggle
        this.register('ctrl+shift+l', () => this.app.toggleTheme(), 'Toggle theme');
        this.register('meta+shift+l', () => this.app.toggleTheme(), 'Toggle theme');
    }

    handleKeydown(e) {
        const combo = this.getCombo(e);
        if (this.shortcuts.has(combo)) {
            e.preventDefault();
            this.shortcuts.get(combo).callback();
        }
    }

    getCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.metaKey) parts.push('meta');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.key && !['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            parts.push(e.key.toLowerCase());
        }
        return parts.join('+');
    }

    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([combo, data]) => ({
            combo,
            description: data.description
        }));
    }
}

class ThemeManager {
    constructor(state) {
        this.state = state;
        this.init();
    }

    init() {
        this.applyTheme(this.state.get('theme'));
        this.state.subscribe('theme', (theme) => this.applyTheme(theme));

        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)')
                .addEventListener('change', (e) => {
                    if (this.state.get('theme') === 'system') {
                        this.applyTheme('system');
                    }
                });
        }
    }

    applyTheme(theme) {
        let actualTheme = theme;
        if (theme === 'system') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', actualTheme);
        document.body.className = `theme-${actualTheme}`;

        // Update theme toggle button icon
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            const icon = themeBtn.querySelector('i');
            if (icon) {
                icon.className = actualTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }

    toggle() {
        const current = this.state.get('theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.state.set('theme', next);
    }
}

// Toast notification utility
class Toast {
    static container = null;

    static init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    static show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span class="toast-message">${Utils.escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Close notification">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    }

    static dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        toast.style.animation = 'slideOut 0.2s ease forwards';
        setTimeout(() => toast.remove(), 200);
    }

    static success(message, duration) {
        return this.show(message, 'success', duration);
    }

    static error(message, duration) {
        return this.show(message, 'error', duration);
    }

    static warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    static info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Utility functions
const Utils = {
    generateId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
    },

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    },

    throttle(fn, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { month: 'short', day: 'numeric' },
            long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        return d.toLocaleDateString('en-US', options[format] || options.short);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    slugify(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    },

    getRelativeTime(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return Utils.formatDate(date);
    }
};

// Main Application Class
class PlannerApp {
    constructor() {
        this.events = new EventBus();
        this.state = new AppState();
        this.keyboard = new KeyboardManager(this);
        this.theme = new ThemeManager(this.state);
        this.modules = new Map();

        this.init();
    }

    async init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Initialize data layer
        if (window.DataManager) {
            this.data = new DataManager();
            await this.data.init();
        }

        // Initialize navigation
        if (window.NavigationManager) {
            this.navigation = new NavigationManager(this);
        }

        // Load initial content
        await this.loadInitialContent();

        // Bind navbar button handlers
        this.bindNavbarEvents();

        this.events.emit('app:ready');
        console.log('🚀 Planner App initialized');
    }

    bindNavbarEvents() {
        // Theme toggle button
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Search button opens command palette
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.toggleCommandPalette());
        }
    }

    async loadInitialContent() {
        // Load workspace or show welcome
        const workspaces = this.data ? await this.data.getWorkspaces() : [];

        if (workspaces.length === 0) {
            // Create default workspace
            if (this.data) {
                const workspace = await this.data.createWorkspace({
                    name: 'My Workspace',
                    icon: '📚'
                });
                this.state.set('currentWorkspace', workspace.id);

                // Create welcome page
                const page = await this.data.createPage({
                    title: 'Welcome to Planner',
                    icon: '👋',
                    workspaceId: workspace.id
                });
                await this.navigateToPage(page.id);
            }
        } else {
            this.state.set('currentWorkspace', workspaces[0].id);
            const pages = await this.data.getPages(workspaces[0].id);
            if (pages.length > 0) {
                await this.navigateToPage(pages[0].id);
            }
        }
    }

    registerModule(name, module) {
        this.modules.set(name, module);
    }

    getModule(name) {
        return this.modules.get(name);
    }

    // Navigation methods
    async navigateToPage(pageId) {
        const page = await this.data?.getPage(pageId);
        if (page) {
            this.state.set('currentPage', pageId);
            this.state.addRecentPage(pageId);
            this.events.emit('navigation:pageChanged', page);
        }
    }

    toggleCommandPalette() {
        const isOpen = this.state.get('commandPaletteOpen');
        this.state.set('commandPaletteOpen', !isOpen);
        this.events.emit('commandPalette:toggle', !isOpen);
    }

    toggleSidebar() {
        const isCollapsed = this.state.get('sidebarCollapsed');
        this.state.set('sidebarCollapsed', !isCollapsed);
        document.body.classList.toggle('sidebar-collapsed', !isCollapsed);

        // Also toggle 'open' class for mobile view
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open', isCollapsed);
        }
    }

    toggleTheme() {
        this.theme.toggle();
    }

    async createNewPage(parentId = null) {
        if (!this.data) return;

        const workspaceId = this.state.get('currentWorkspace');
        const page = await this.data.createPage({
            title: 'Untitled',
            icon: '📄',
            workspaceId,
            parentId
        });

        await this.navigateToPage(page.id);
        this.events.emit('page:created', page);
        return page;
    }
}

// Export for use
window.EventBus = EventBus;
window.AppState = AppState;
window.Utils = Utils;
window.Toast = Toast;
window.PlannerApp = PlannerApp;
