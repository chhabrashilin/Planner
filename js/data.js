/**
 * Notion-Level Planner - Data Layer
 * IndexedDB-based persistence with full CRUD operations
 */

class DataManager {
    constructor() {
        this.dbName = 'PlannerDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.migrateFromLocalStorage();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Workspaces store
                if (!db.objectStoreNames.contains('workspaces')) {
                    const workspaces = db.createObjectStore('workspaces', { keyPath: 'id' });
                    workspaces.createIndex('name', 'name', { unique: false });
                    workspaces.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Pages store
                if (!db.objectStoreNames.contains('pages')) {
                    const pages = db.createObjectStore('pages', { keyPath: 'id' });
                    pages.createIndex('workspaceId', 'workspaceId', { unique: false });
                    pages.createIndex('parentId', 'parentId', { unique: false });
                    pages.createIndex('title', 'title', { unique: false });
                    pages.createIndex('updatedAt', 'updatedAt', { unique: false });
                    pages.createIndex('isDatabase', 'isDatabase', { unique: false });
                }

                // Blocks store
                if (!db.objectStoreNames.contains('blocks')) {
                    const blocks = db.createObjectStore('blocks', { keyPath: 'id' });
                    blocks.createIndex('pageId', 'pageId', { unique: false });
                    blocks.createIndex('parentId', 'parentId', { unique: false });
                    blocks.createIndex('type', 'type', { unique: false });
                    blocks.createIndex('order', 'order', { unique: false });
                }

                // Database views store
                if (!db.objectStoreNames.contains('views')) {
                    const views = db.createObjectStore('views', { keyPath: 'id' });
                    views.createIndex('databaseId', 'databaseId', { unique: false });
                    views.createIndex('type', 'type', { unique: false });
                }

                // Database rows store
                if (!db.objectStoreNames.contains('rows')) {
                    const rows = db.createObjectStore('rows', { keyPath: 'id' });
                    rows.createIndex('databaseId', 'databaseId', { unique: false });
                    rows.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    // Generic CRUD operations
    async _add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async _get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async _delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Workspace operations
    async createWorkspace(data) {
        const workspace = {
            id: Utils.generateId(),
            name: data.name || 'My Workspace',
            icon: data.icon || '📚',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: data.settings || {}
        };
        return this._add('workspaces', workspace);
    }

    async getWorkspace(id) {
        return this._get('workspaces', id);
    }

    async getWorkspaces() {
        return this._getAll('workspaces');
    }

    async updateWorkspace(id, data) {
        const workspace = await this.getWorkspace(id);
        if (!workspace) throw new Error('Workspace not found');
        const updated = { ...workspace, ...data, updatedAt: new Date().toISOString() };
        return this._update('workspaces', updated);
    }

    async deleteWorkspace(id) {
        // Delete all pages in workspace first
        const pages = await this.getPages(id);
        for (const page of pages) {
            await this.deletePage(page.id);
        }
        return this._delete('workspaces', id);
    }

    // Page operations
    async createPage(data) {
        const page = {
            id: Utils.generateId(),
            title: data.title || 'Untitled',
            icon: data.icon || '📄',
            cover: data.cover || null,
            workspaceId: data.workspaceId,
            parentId: data.parentId || null,
            isDatabase: data.isDatabase || false,
            databaseSchema: data.databaseSchema || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            archived: false
        };
        return this._add('pages', page);
    }

    async getPage(id) {
        return this._get('pages', id);
    }

    async getPages(workspaceId, parentId = null) {
        const pages = await this._getByIndex('pages', 'workspaceId', workspaceId);
        return pages.filter(p => p.parentId === parentId && !p.archived)
            .sort((a, b) => a.title.localeCompare(b.title));
    }

    async getChildPages(parentId) {
        return this._getByIndex('pages', 'parentId', parentId);
    }

    async updatePage(id, data) {
        const page = await this.getPage(id);
        if (!page) throw new Error('Page not found');
        const updated = { ...page, ...data, updatedAt: new Date().toISOString() };
        return this._update('pages', updated);
    }

    async deletePage(id, permanent = false) {
        if (permanent) {
            // Delete all blocks
            const blocks = await this.getBlocks(id);
            for (const block of blocks) {
                await this._delete('blocks', block.id);
            }
            // Delete child pages
            const children = await this.getChildPages(id);
            for (const child of children) {
                await this.deletePage(child.id, true);
            }
            return this._delete('pages', id);
        } else {
            return this.updatePage(id, { archived: true });
        }
    }

    async searchPages(query, workspaceId = null) {
        const pages = workspaceId
            ? await this._getByIndex('pages', 'workspaceId', workspaceId)
            : await this._getAll('pages');

        const q = query.toLowerCase();
        return pages.filter(p =>
            !p.archived &&
            (p.title.toLowerCase().includes(q))
        );
    }

    // Block operations
    async createBlock(data) {
        const block = {
            id: Utils.generateId(),
            pageId: data.pageId,
            parentId: data.parentId || null,
            type: data.type || 'paragraph',
            content: data.content || '',
            properties: data.properties || {},
            order: data.order || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return this._add('blocks', block);
    }

    async getBlock(id) {
        return this._get('blocks', id);
    }

    async getBlocks(pageId) {
        const blocks = await this._getByIndex('blocks', 'pageId', pageId);
        return blocks.sort((a, b) => a.order - b.order);
    }

    async updateBlock(id, data) {
        const block = await this.getBlock(id);
        if (!block) throw new Error('Block not found');
        const updated = { ...block, ...data, updatedAt: new Date().toISOString() };
        return this._update('blocks', updated);
    }

    async deleteBlock(id) {
        // Delete child blocks first
        const children = await this._getByIndex('blocks', 'parentId', id);
        for (const child of children) {
            await this.deleteBlock(child.id);
        }
        return this._delete('blocks', id);
    }

    async reorderBlocks(pageId, orderedIds) {
        const blocks = await this.getBlocks(pageId);
        for (let i = 0; i < orderedIds.length; i++) {
            const block = blocks.find(b => b.id === orderedIds[i]);
            if (block) {
                await this.updateBlock(block.id, { order: i });
            }
        }
    }

    // Database row operations
    async createRow(data) {
        const row = {
            id: Utils.generateId(),
            databaseId: data.databaseId,
            properties: data.properties || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return this._add('rows', row);
    }

    async getRow(id) {
        return this._get('rows', id);
    }

    async getRows(databaseId) {
        return this._getByIndex('rows', 'databaseId', databaseId);
    }

    async updateRow(id, data) {
        const row = await this.getRow(id);
        if (!row) throw new Error('Row not found');
        const updated = { ...row, ...data, updatedAt: new Date().toISOString() };
        return this._update('rows', updated);
    }

    async deleteRow(id) {
        return this._delete('rows', id);
    }

    // View operations
    async createView(data) {
        const view = {
            id: Utils.generateId(),
            databaseId: data.databaseId,
            name: data.name || 'Default View',
            type: data.type || 'table',
            filter: data.filter || [],
            sort: data.sort || [],
            properties: data.properties || {},
            createdAt: new Date().toISOString()
        };
        return this._add('views', view);
    }

    async getViews(databaseId) {
        return this._getByIndex('views', 'databaseId', databaseId);
    }

    async updateView(id, data) {
        const view = await this._get('views', id);
        if (!view) throw new Error('View not found');
        return this._update('views', { ...view, ...data });
    }

    async deleteView(id) {
        return this._delete('views', id);
    }

    // Export/Import
    async exportAll() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            workspaces: await this._getAll('workspaces'),
            pages: await this._getAll('pages'),
            blocks: await this._getAll('blocks'),
            views: await this._getAll('views'),
            rows: await this._getAll('rows')
        };
        return JSON.stringify(data, null, 2);
    }

    async importAll(jsonString) {
        const data = JSON.parse(jsonString);

        // Clear existing data
        const stores = ['workspaces', 'pages', 'blocks', 'views', 'rows'];
        for (const store of stores) {
            const items = await this._getAll(store);
            for (const item of items) {
                await this._delete(store, item.id);
            }
        }

        // Import new data
        for (const workspace of data.workspaces || []) {
            await this._add('workspaces', workspace);
        }
        for (const page of data.pages || []) {
            await this._add('pages', page);
        }
        for (const block of data.blocks || []) {
            await this._add('blocks', block);
        }
        for (const view of data.views || []) {
            await this._add('views', view);
        }
        for (const row of data.rows || []) {
            await this._add('rows', row);
        }

        return true;
    }

    // Migration from localStorage
    async migrateFromLocalStorage() {
        const oldTasks = localStorage.getItem('calendarPlannerTasks');
        if (!oldTasks) return;

        try {
            const tasks = JSON.parse(oldTasks);
            if (!Array.isArray(tasks) || tasks.length === 0) return;

            // Check if already migrated
            const workspaces = await this.getWorkspaces();
            if (workspaces.length > 0) return;

            // Create workspace
            const workspace = await this.createWorkspace({
                name: 'My Workspace',
                icon: '📚'
            });

            // Create a Tasks database page
            const tasksPage = await this.createPage({
                title: 'Tasks',
                icon: '✅',
                workspaceId: workspace.id,
                isDatabase: true,
                databaseSchema: {
                    properties: [
                        { id: 'title', name: 'Title', type: 'title' },
                        { id: 'description', name: 'Description', type: 'text' },
                        {
                            id: 'category', name: 'Category', type: 'select', options: [
                                { id: 'work', name: 'Work', color: 'blue' },
                                { id: 'personal', name: 'Personal', color: 'green' },
                                { id: 'health', name: 'Health', color: 'red' },
                                { id: 'other', name: 'Other', color: 'gray' }
                            ]
                        },
                        { id: 'date', name: 'Date', type: 'date' },
                        { id: 'time', name: 'Time', type: 'text' },
                        { id: 'completed', name: 'Completed', type: 'checkbox' }
                    ]
                }
            });

            // Create default view
            await this.createView({
                databaseId: tasksPage.id,
                name: 'Calendar',
                type: 'calendar',
                properties: { dateProperty: 'date' }
            });

            await this.createView({
                databaseId: tasksPage.id,
                name: 'All Tasks',
                type: 'table'
            });

            // Migrate tasks as rows
            for (const task of tasks) {
                await this.createRow({
                    databaseId: tasksPage.id,
                    properties: {
                        title: task.title,
                        description: task.description || '',
                        category: task.category,
                        date: task.date,
                        time: task.time || '',
                        completed: task.completed || false
                    }
                });
            }

            // Mark as migrated
            localStorage.setItem('plannerMigrated', 'true');
            console.log(`✅ Migrated ${tasks.length} tasks from localStorage`);

        } catch (error) {
            console.error('Migration failed:', error);
        }
    }
}

// Export
window.DataManager = DataManager;
