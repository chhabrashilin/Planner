// Calendar Planner JavaScript

class CalendarPlanner {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.tasks = this.loadTasks();
        this.currentCategory = 'all';
        
        this.init();
    }
    
    init() {
        this.renderCalendar();
        this.bindEvents();
        this.updateStats();
        this.updateCategoryButtons();
    }
    
    // Calendar Rendering
    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonth = document.getElementById('currentMonth');
        const currentYear = document.getElementById('currentYear');
        
        // Update header
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        currentMonth.textContent = monthNames[this.currentDate.getMonth()];
        currentYear.textContent = this.currentDate.getFullYear();
        
        // Clear calendar
        calendarGrid.innerHTML = '';
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = this.createDayElement(null, true);
            calendarGrid.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dayElement = this.createDayElement(date, false);
            calendarGrid.appendChild(dayElement);
        }
        
        // Add empty cells for remaining days
        const totalCells = calendarGrid.children.length;
        const remainingCells = 42 - totalCells; // 6 weeks * 7 days
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = this.createDayElement(null, true);
            calendarGrid.appendChild(emptyDay);
        }
    }
    
    createDayElement(date, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        } else {
            dayElement.classList.add('fade-in');
            dayElement.dataset.date = date.toISOString().split('T')[0];
            
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = date.getDate();
            dayElement.appendChild(dayNumber);
            
            // Add task indicators
            const taskIndicator = this.createTaskIndicator(date);
            if (taskIndicator) {
                dayElement.appendChild(taskIndicator);
            }
            
            // Add today class
            const today = new Date();
            if (this.isSameDay(date, today)) {
                dayElement.classList.add('today');
            }
            
            // Add selected class
            if (this.selectedDate && this.isSameDay(date, this.selectedDate)) {
                dayElement.classList.add('selected');
            }
            
            // Add click event
            dayElement.addEventListener('click', () => this.selectDate(date));
        }
        
        return dayElement;
    }
    
    createTaskIndicator(date) {
        const dateString = date.toISOString().split('T')[0];
        const dayTasks = this.getTasksForDate(dateString);
        
        if (dayTasks.length === 0) return null;
        
        const indicator = document.createElement('div');
        indicator.className = 'task-indicator';
        
        // Group tasks by category
        const categories = {};
        dayTasks.forEach(task => {
            if (!categories[task.category]) {
                categories[task.category] = 0;
            }
            categories[task.category]++;
        });
        
        // Create dots for each category
        Object.keys(categories).forEach(category => {
            const dot = document.createElement('span');
            dot.className = `task-dot ${category}`;
            dot.title = `${categories[category]} ${category} task(s)`;
            indicator.appendChild(dot);
        });
        
        return indicator;
    }
    
    // Date Navigation
    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.renderCalendar();
        this.showTasksForDate(date);
    }
    
    showTasksForDate(date) {
        const selectedDateCard = document.getElementById('selectedDateCard');
        const selectedDateTitle = document.getElementById('selectedDateTitle');
        const taskList = document.getElementById('taskList');
        
        const dateString = date.toISOString().split('T')[0];
        const dayTasks = this.getTasksForDate(dateString);
        
        selectedDateTitle.textContent = `Tasks for ${date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`;
        
        if (dayTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <h6>No tasks for this date</h6>
                    <p>Click "Add Task" to create your first task for this day.</p>
                </div>
            `;
        } else {
            taskList.innerHTML = dayTasks.map(task => this.createTaskHTML(task)).join('');
        }
        
        selectedDateCard.style.display = 'block';
        selectedDateCard.classList.add('slide-in');
    }
    
    // Task Management
    createTaskHTML(task) {
        const completedClass = task.completed ? 'completed' : '';
        const timeDisplay = task.time ? `<i class="fas fa-clock me-1"></i>${task.time}` : '';
        
        return `
            <div class="task-item ${completedClass}" data-task-id="${task.id}">
                <div class="task-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="planner.editTask('${task.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="planner.deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                <div class="task-meta">
                    <span class="task-category ${task.category}">${task.category}</span>
                    ${timeDisplay}
                    <div class="form-check form-check-inline ms-auto">
                        <input class="form-check-input" type="checkbox" ${task.completed ? 'checked' : ''} 
                               onchange="planner.toggleTaskCompletion('${task.id}')">
                        <label class="form-check-label">Completed</label>
                    </div>
                </div>
            </div>
        `;
    }
    
    addTask() {
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        const form = document.getElementById('taskForm');
        const modalTitle = document.getElementById('taskModalTitle');
        
        modalTitle.textContent = 'Add New Task';
        form.reset();
        
        // Set default date if a date is selected
        if (this.selectedDate) {
            // The date will be handled in saveTask
        }
        
        modal.show();
    }
    
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        const form = document.getElementById('taskForm');
        const modalTitle = document.getElementById('taskModalTitle');
        
        modalTitle.textContent = 'Edit Task';
        
        // Populate form
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskTime').value = task.time || '';
        document.getElementById('taskCompleted').checked = task.completed;
        
        // Store task ID for editing
        form.dataset.editingTaskId = taskId;
        
        modal.show();
    }
    
    saveTask() {
        const form = document.getElementById('taskForm');
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const category = document.getElementById('taskCategory').value;
        const time = document.getElementById('taskTime').value;
        const completed = document.getElementById('taskCompleted').checked;
        
        if (!title) {
            this.showAlert('Please enter a task title.', 'danger');
            return;
        }
        
        const editingTaskId = form.dataset.editingTaskId;
        
        if (editingTaskId) {
            // Edit existing task
            const taskIndex = this.tasks.findIndex(t => t.id === editingTaskId);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = {
                    ...this.tasks[taskIndex],
                    title,
                    description,
                    category,
                    time,
                    completed
                };
            }
            delete form.dataset.editingTaskId;
        } else {
            // Add new task
            const task = {
                id: this.generateId(),
                title,
                description,
                category,
                time,
                completed,
                date: this.selectedDate ? this.selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            };
            this.tasks.push(task);
        }
        
        this.saveTasks();
        this.renderCalendar();
        this.updateStats();
        
        if (this.selectedDate) {
            this.showTasksForDate(this.selectedDate);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
        this.showAlert(editingTaskId ? 'Task updated successfully!' : 'Task added successfully!', 'success');
    }
    
    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveTasks();
            this.renderCalendar();
            this.updateStats();
            
            if (this.selectedDate) {
                this.showTasksForDate(this.selectedDate);
            }
            
            this.showAlert('Task deleted successfully!', 'success');
        }
    }
    
    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.updateStats();
            
            if (this.selectedDate) {
                this.showTasksForDate(this.selectedDate);
            }
        }
    }
    
    // Category Filtering
    filterByCategory(category) {
        this.currentCategory = category;
        this.updateCategoryButtons();
        
        if (this.selectedDate) {
            this.showTasksForDate(this.selectedDate);
        }
    }
    
    updateCategoryButtons() {
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === this.currentCategory) {
                btn.classList.add('active');
            }
        });
    }
    
    getTasksForDate(dateString) {
        let dayTasks = this.tasks.filter(task => task.date === dateString);
        
        if (this.currentCategory !== 'all') {
            dayTasks = dayTasks.filter(task => task.category === this.currentCategory);
        }
        
        return dayTasks.sort((a, b) => {
            if (a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            if (a.time && !b.time) return -1;
            if (!a.time && b.time) return 1;
            return a.title.localeCompare(b.title);
        });
    }
    
    // Statistics
    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.tasks.filter(task => task.date === today);
        
        document.getElementById('todayTaskCount').textContent = todayTasks.length;
        
        // Calculate week tasks
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date();
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const weekTasks = this.tasks.filter(task => {
            const taskDate = new Date(task.date);
            return taskDate >= startOfWeek && taskDate <= endOfWeek;
        });
        
        document.getElementById('weekTaskCount').textContent = weekTasks.length;
    }
    
    // Utility Functions
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    // Local Storage
    saveTasks() {
        localStorage.setItem('calendarPlannerTasks', JSON.stringify(this.tasks));
    }
    
    loadTasks() {
        const saved = localStorage.getItem('calendarPlannerTasks');
        return saved ? JSON.parse(saved) : [];
    }
    
    // Event Binding
    bindEvents() {
        // Navigation buttons
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());
        
        // Task management
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.saveTask());
        
        // Category filtering
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.navigateMonth(-1);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.navigateMonth(1);
                        break;
                    case 't':
                        e.preventDefault();
                        this.goToToday();
                        break;
                }
            }
        });
        
        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });
    }
}

// Initialize the planner when the page loads
let planner;
document.addEventListener('DOMContentLoaded', () => {
    planner = new CalendarPlanner();
});
