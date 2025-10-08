# Calendar Planner

A beautiful, full-featured calendar-based planner built with Bootstrap and vanilla JavaScript. Organize your tasks, track your schedule, and stay productive with this intuitive planning tool.

## Features

### 📅 Calendar View
- **Monthly Calendar**: Navigate through months with a clean, intuitive interface
- **Today Highlighting**: Current date is clearly marked
- **Task Indicators**: Visual dots show tasks for each day, color-coded by category
- **Date Selection**: Click any date to view and manage tasks for that day

### ✅ Task Management
- **Add Tasks**: Create new tasks with title, description, category, and time
- **Edit Tasks**: Modify existing tasks with a simple click
- **Delete Tasks**: Remove tasks with confirmation
- **Mark Complete**: Toggle task completion status
- **Categories**: Organize tasks into Work, Personal, Health, and Other categories

### 🎨 Beautiful Design
- **Modern UI**: Clean, professional design with Bootstrap 5
- **Responsive**: Works perfectly on desktop, tablet, and mobile devices
- **Smooth Animations**: Elegant transitions and hover effects
- **Color Coding**: Different colors for different task categories

### 📊 Statistics & Organization
- **Quick Stats**: See today's and this week's task counts at a glance
- **Category Filtering**: Filter tasks by category to focus on specific areas
- **Task Sorting**: Tasks are automatically sorted by time and title

### 💾 Data Persistence
- **Local Storage**: All your tasks are saved locally in your browser
- **No Account Required**: Start using immediately without any setup

## How to Use

### Getting Started
1. Open `index.html` in your web browser
2. The calendar will show the current month
3. Click on any date to view or add tasks for that day

### Adding Tasks
1. Click on a date in the calendar
2. Click the "Add Task" button
3. Fill in the task details:
   - **Title** (required): Brief description of the task
   - **Description** (optional): Additional details
   - **Category**: Choose from Work, Personal, Health, or Other
   - **Time** (optional): Set a specific time for the task
   - **Completed**: Mark if the task is already done
4. Click "Save Task"

### Managing Tasks
- **View Tasks**: Click on any date to see tasks for that day
- **Edit Task**: Click the edit button (pencil icon) on any task
- **Delete Task**: Click the delete button (trash icon) on any task
- **Mark Complete**: Check the "Completed" checkbox on any task

### Navigation
- **Month Navigation**: Use the arrow buttons or keyboard shortcuts
- **Go to Today**: Click the "Today" button to return to the current month
- **Category Filter**: Click on category buttons in the sidebar to filter tasks

### Keyboard Shortcuts
- `Ctrl/Cmd + ←`: Previous month
- `Ctrl/Cmd + →`: Next month
- `Ctrl/Cmd + T`: Go to today

## File Structure

```
Planner/
├── index.html          # Main HTML file
├── styles.css          # Custom CSS styles
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

## Browser Compatibility

This planner works in all modern browsers including:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Customization

### Adding New Categories
To add new task categories:

1. **Update HTML** (`index.html`):
   ```html
   <button class="list-group-item list-group-item-action" data-category="newcategory">
       <i class="fas fa-icon me-2"></i>New Category
   </button>
   ```

2. **Update CSS** (`styles.css`):
   ```css
   .task-category.newcategory {
       background-color: rgba(255, 0, 0, 0.1);
       color: #ff0000;
   }
   .task-dot.newcategory { background-color: #ff0000; }
   ```

3. **Update JavaScript** (`script.js`):
   ```javascript
   <option value="newcategory">New Category</option>
   ```

### Changing Colors
Modify the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #your-color;
    --success-color: #your-color;
    /* ... other colors */
}
```

## Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **Bootstrap 5**: Responsive framework and components
- **Font Awesome**: Icons
- **Vanilla JavaScript**: No external dependencies

### Data Storage
Tasks are stored in the browser's localStorage as JSON. The data structure:
```javascript
{
    id: "unique-id",
    title: "Task title",
    description: "Task description",
    category: "work|personal|health|other",
    time: "HH:MM",
    completed: true|false,
    date: "YYYY-MM-DD"
}
```

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to fork this project and submit pull requests for any improvements!

## Support

If you encounter any issues or have suggestions, please create an issue in the project repository.
