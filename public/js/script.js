// public/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');

    // Header Elements
    const userGreeting = document.getElementById('user-greeting');
    const newTaskBtnHeader = document.getElementById('new-task-btn-header');
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const logoutBtnHeader = document.getElementById('logout-btn-header');

    // Search and Filter Bar Elements
    const searchInput = document.getElementById('search-input');
    const dueDateFilter = document.getElementById('due-date-filter');
    const applyFilterBtn = document.getElementById('apply-filter-btn');

    // Main Content Elements
    const categoriesListHorizontal = document.getElementById('categories-list-horizontal'); // Horizontal filter tabs
    const tasksList = document.getElementById('tasks-list');
    const tasksListContainer = document.getElementById('tasks-list-container');

    // Modals
    const categoryManagementModal = document.getElementById('category-management-modal'); // New modal for category management
    const newCategoryForm = document.getElementById('new-category-form'); // Form within category management modal
    const newCategoryNameInput = document.getElementById('new-category-name'); // Input within new category form
    const existingCategoriesList = document.getElementById('existing-categories-list'); // List for managing categories

    // Filtered Tasks Modal
    const filteredTasksModal = document.getElementById('filtered-tasks-modal');
    const filteredTasksList = document = document.getElementById('filtered-tasks-list');

    const taskModal = document.getElementById('task-modal'); // Existing task create/edit modal
    const taskModalTitle = document.getElementById('task-modal-title');
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDescriptionTextarea = document.getElementById('task-description');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskPrioritySelect = document.getElementById('task-priority');
    const taskCategorySelect = document.getElementById('task-category');

    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');

    // Notification Toast Container
    const toastContainer = document.getElementById('toast-container');

    let currentCategories = [];
    let currentTasks = [];
    let activeCategoryId = 'all'; // Default to 'all' tasks

    // To store the ID of the task being dragged
    let draggedTaskId = null; 

    // --- Utility Functions ---

    /**
     * Helper function to get authentication headers.
     * @returns {HeadersInit} - Object containing Authorization header if token exists.
     */
    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }) // Add token if it exists
        };
    }

    /**
     * Displays a toast notification.
     * @param {string} message - The message to display.
     * @param {'success' | 'error' | 'info'} type - The type of toast (determines styling and icon).
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;

        let iconClass = '';
        if (type === 'success') {
            iconClass = 'fas fa-check-circle';
        } else if (type === 'error') {
            iconClass = 'fas fa-exclamation-circle';
        } else {
            iconClass = 'fas fa-info-circle';
        }

        toast.innerHTML = `
            <i class="toast-icon ${iconClass}"></i>
            <span class="toast-message">${message}</span>
        `;
        toastContainer.appendChild(toast);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 5000);
    }

    /**
     * Shows a custom confirmation modal.
     * @param {string} message - The message to display in the modal.
     * @returns {Promise<boolean>} - Resolves with true if confirmed, false otherwise.
     */
    function showConfirmation(message) {
        return new Promise(resolve => {
            confirmMessage.textContent = message;
            showModal(confirmationModal);
            
            const onConfirm = () => {
                hideModal(confirmationModal);
                confirmYesBtn.removeEventListener('click', onConfirm);
                confirmNoBtn.removeEventListener('click', onCancel);
                resolve(true);
            };

            const onCancel = () => {
                hideModal(confirmationModal);
                confirmYesBtn.removeEventListener('click', onConfirm);
                confirmNoBtn.removeEventListener('click', onCancel);
                resolve(false);
            };

            confirmYesBtn.addEventListener('click', onConfirm);
            confirmNoBtn.addEventListener('click', onCancel);
        });
    }

    /**
     * Shows a modal.
     * @param {HTMLElement} modalElement - The modal DOM element.
     */
    function showModal(modalElement) {
        modalElement.classList.remove('hidden');
        requestAnimationFrame(() => {
            modalElement.classList.add('active');
        });
    }

    /**
     * Hides a modal.
     * @param {HTMLElement} modalElement - The modal DOM element.
     */
    function hideModal(modalElement) {
        modalElement.classList.remove('active');
        modalElement.addEventListener('transitionend', () => {
            if (!modalElement.classList.contains('active')) {
                modalElement.classList.add('hidden');
            }
        }, { once: true });
    }

    /**
     * Checks if 'New Task' button should be disabled based on categories.
     * This is crucial because a task *requires* a category.
     */
    function updateNewTaskButtonState() {
        if (currentCategories.length === 0) {
            newTaskBtnHeader.disabled = true;
            newTaskBtnHeader.classList.add('disabled:opacity-50', 'disabled:cursor-not-allowed');
        } else {
            newTaskBtnHeader.disabled = false;
            newTaskBtnHeader.classList.remove('disabled:opacity-50', 'disabled:cursor-not-allowed');
        }
    }

    // --- API Calls ---

    /**
     * Fetches all categories for the current user.
     */
    async function fetchCategories() {
        try {
            console.log('Fetching categories...');
            const response = await fetch('/api/categories', {
                headers: getAuthHeaders() // Include auth headers
            });
            if (!response.ok) {
                console.error('API Error: Response not OK for categories', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(`Failed to fetch categories: ${errorData.message || response.statusText}`);
            }
            currentCategories = await response.json();
            console.log('Categories fetched:', currentCategories);
            renderCategories(); // Render categories in the filter bar
            renderExistingCategoriesList(); // Render categories in the management modal
            populateCategorySelect(); // Populate the dropdown in task modal
            updateNewTaskButtonState(); // Update task button state

            // Set a default active category if none is selected and categories exist
            if (currentCategories.length > 0) {
                const previouslyActiveCategoryExists = currentCategories.some(cat => cat._id === activeCategoryId);
                if (activeCategoryId === 'all' || previouslyActiveCategoryExists) {
                    setActiveCategory(activeCategoryId); // Re-activate 'all' or the previous category
                } else {
                    setActiveCategory('all');
                }
            } else { // No categories exist at all
                setActiveCategory('all'); // Ensure 'All Tasks' button is active
            }
            // Initial fetch of tasks for the main view without filters
            fetchTasks(false); // Pass false to indicate no filters applied from search/date bar
        } catch (error) {
            console.error('Error fetching categories:', error);
            showToast('Failed to load categories.', 'error');
            // If auth error, redirect to login
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout(); // Force logout if token is invalid or missing
            }
        }
    }

    /**
     * Fetches all tasks for the current user.
     * @param {boolean} applySearchAndDateFilters - If true, applies search and due date filters from the input fields.
     * If false, fetches tasks based only on active category.
     */
    async function fetchTasks(applySearchAndDateFilters = false) {
        try {
            let url = '/api/tasks';
            const params = new URLSearchParams();
            const searchQuery = searchInput.value.trim();
            const dueDateFilterValue = dueDateFilter.value;

            if (applySearchAndDateFilters) {
                // Debugging: Log values before making the API call
                console.log('Client-side fetchTasks (with search/date filters):');
                console.log('  searchQuery:', searchQuery);
                console.log('  dueDateFilterValue:', dueDateFilterValue);

                if (searchQuery) {
                    params.append('search', searchQuery);
                }
                if (dueDateFilterValue && dueDateFilterValue !== 'all') {
                    params.append('dueDate', dueDateFilterValue);
                }
                url = `/api/tasks?${params.toString()}`;

            } else { // Fetching for main display, only category filter applies
                console.log('Client-side fetchTasks (for main view, by category):');
                url = `/api/tasks`;
            }

            console.log('Fetching tasks from URL:', url);

            const response = await fetch(url, {
                headers: getAuthHeaders() // Include auth headers
            });
            if (!response.ok) {
                console.error('API Error: Response not OK for tasks', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(`Failed to fetch tasks: ${errorData.message || response.statusText}`);
            }
            const fetchedTasks = await response.json();
            console.log('Tasks fetched:', fetchedTasks);

            if (applySearchAndDateFilters) {
                renderTasksInFilteredModal(fetchedTasks);
            } else {
                currentTasks = fetchedTasks; // Update global currentTasks for main view
                renderTasks(); // Render tasks based on activeCategoryId from the updated currentTasks
            }
            
            if (fetchedTasks.length === 0 && (searchQuery || dueDateFilterValue !== 'all')) {
                console.warn('No tasks found matching the current filters.');
            }

        } catch (error) {
            console.error('Error fetching tasks:', error);
            showToast('Failed to load tasks.', 'error');
            // If auth error, redirect to login
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout(); // Force logout if token is invalid or missing
            }
        }
    }

    // --- Rendering Functions ---

    /**
     * Renders categories as filter tabs in the header.
     */
    function renderCategories() {
        categoriesListHorizontal.innerHTML = ''; // Clear existing categories

        // Add an "All Tasks" button
        const allTasksButton = document.createElement('button');
        allTasksButton.className = 'category-button'; // Will get 'active' class from setActiveCategory
        allTasksButton.dataset.categoryId = 'all'; // Special ID for all tasks
        allTasksButton.innerHTML = `<i class="fas fa-list-ul mr-1"></i> All Tasks`;
        categoriesListHorizontal.appendChild(allTasksButton);
        allTasksButton.addEventListener('click', () => {
            setActiveCategory('all');
        });
        allTasksButton.addEventListener('dragover', handleCategoryDragOver);
        allTasksButton.addEventListener('drop', handleCategoryDrop);
        allTasksButton.addEventListener('dragleave', handleCategoryDragLeave);
        
        currentCategories.forEach(category => {
            const categoryButton = document.createElement('button');
            categoryButton.className = 'category-button';
            categoryButton.dataset.categoryId = category._id;
            categoryButton.innerHTML = `
                <span>${category.name}</span>
                <i data-id="${category._id}" class="delete-category-btn fas fa-trash ml-2"></i>
            `;
            categoriesListHorizontal.appendChild(categoryButton);

            categoryButton.addEventListener('click', (e) => {
                // Prevent event from bubbling to delete button if delete is clicked
                if (!e.target.classList.contains('delete-category-btn')) {
                    setActiveCategory(category._id);
                }
            });
            categoryButton.addEventListener('dragover', handleCategoryDragOver);
            categoryButton.addEventListener('drop', handleCategoryDrop);
            categoryButton.addEventListener('dragleave', handleCategoryDragLeave);
            // Attach delete listeners to the trash icon specifically
            categoryButton.querySelector('.delete-category-btn').addEventListener('click', handleDeleteCategory);
        });

        // Re-apply active class after all buttons are rendered
        if (activeCategoryId) {
            const activeBtn = document.querySelector(`.category-button[data-category-id="${activeCategoryId}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    /**
     * Renders categories in the separate management modal.
     */
    function renderExistingCategoriesList() {
        existingCategoriesList.innerHTML = '';
        if (currentCategories.length === 0) {
            existingCategoriesList.innerHTML = '<p class="text-gray-400 text-center text-sm">No categories yet. Add one above.</p>';
            return;
        }

        currentCategories.forEach(category => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            categoryItem.innerHTML = `
                <span>${category.name}</span>
                <button data-id="${category._id}" class="delete-category-btn bg-red-600 text-white py-1 px-2 rounded-md text-xs hover:bg-red-700">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
            existingCategoriesList.appendChild(categoryItem);
        });

        document.querySelectorAll('#existing-categories-list .delete-category-btn').forEach(button => {
            button.addEventListener('click', handleDeleteCategory);
        });
    }

    /**
     * Sets the active category and filters tasks.
     * @param {string} categoryId - The ID of the category to activate, or 'all'.
     */
    function setActiveCategory(categoryId) {
        document.querySelectorAll('.category-button').forEach(btn => {
            btn.classList.remove('active');
        });

        const selectedButton = document.querySelector(`.category-button[data-category-id="${categoryId}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }

        activeCategoryId = categoryId;
        renderTasks(); // Re-render main tasks list based on new active category
    }

    /**
     * Populates the category select dropdown in the task modal.
     */
    function populateCategorySelect() {
        taskCategorySelect.innerHTML = '';
        console.log('Populating task category select. Current categories:', currentCategories);

        if (currentCategories.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Categories Available';
            option.disabled = true;
            option.selected = true;
            taskCategorySelect.appendChild(option);
            console.log('Task category select populated with "No Categories Available".');
            return;
        }

        currentCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category._id;
            option.textContent = category.name;
            taskCategorySelect.appendChild(option);
            console.log(`Added option to taskCategorySelect: Text=${category.name}, Value=${category._id}`);
        });

        // Set selected value after all options are added
        if (activeCategoryId && activeCategoryId !== 'all' &&
            currentCategories.some(cat => cat._id === activeCategoryId)) {
            taskCategorySelect.value = activeCategoryId;
            console.log('Pre-selected active category in taskCategorySelect:', activeCategoryId);
        } else if (currentCategories.length > 0) {
            taskCategorySelect.value = currentCategories[0]._id;
            console.log('Pre-selected first category in taskCategorySelect:', currentCategories[0]._id);
        } else {
            taskCategorySelect.value = '';
        }
    }

    /**
     * Renders tasks in the main tasks list, filtered by activeCategoryId.
     * This function now exclusively handles rendering for the main `tasksList`.
     */
    function renderTasks() {
        tasksList.innerHTML = '';

        let tasksToRender = currentTasks;
        if (activeCategoryId && activeCategoryId !== 'all') {
            tasksToRender = currentTasks.filter(task => {
                const taskCategoryId = task.category && task.category._id ? task.category._id : task.category;
                return taskCategoryId === activeCategoryId;
            });
            console.log(`Rendering main tasks list: Filtered by category "${activeCategoryId}". Tasks to render:`, tasksToRender.length);
        } else {
            console.log('Rendering main tasks list: All tasks for user (no category filter). Tasks to render:', tasksToRender.length);
        }

        if (tasksToRender.length === 0) {
            tasksList.innerHTML = '<p class="text-gray-400 text-center text-sm col-span-full">No tasks yet. Create your first one!</p>';
            return;
        }

        tasksToRender.forEach(task => {
            const categoryName = task.category && task.category.name ? task.category.name : 'Uncategorized';
            const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Due Date';

            const taskCard = document.createElement('div');
            taskCard.className = `task-card priority-${task.priority.toLowerCase()}`;
            taskCard.dataset.taskId = task._id; // Add task ID for drag and drop
            taskCard.draggable = true; // Make task card draggable
            taskCard.innerHTML = `
                <h4 class="text-lg font-semibold mb-2">${task.title}</h4>
                <p class="text-gray-300 text-sm mb-2">${task.description || 'No description'}</p>
                <div class="task-meta text-xs">
                    <span class="font-medium">Category: <span class="text-purple-300">${categoryName}</span></span>
                    <span class="font-medium">Priority: <span class="priority-text">${task.priority}</span></span>
                    <span class="font-medium w-full text-right md:text-left mt-1 md:mt-0">Due: <span class="text-blue-300">${dueDateText}</span></span>
                </div>
                <div class="mt-4 flex justify-end space-x-2">
                    <button data-id="${task._id}" class="edit-task-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md text-sm shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button data-id="${task._id}" class="delete-task-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md text-sm shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            tasksList.appendChild(taskCard);
        });

        // Attach event listeners to new edit/delete task buttons
        document.querySelectorAll('#tasks-list .edit-task-btn').forEach(button => {
            button.addEventListener('click', handleEditTask);
        });
        document.querySelectorAll('#tasks-list .delete-task-btn').forEach(button => {
            button.addEventListener('click', handleDeleteTask);
        });

        // Attach drag-and-drop listeners to task cards
        document.querySelectorAll('#tasks-list .task-card').forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });
    }

    /**
     * Renders tasks into the filtered tasks modal.
     * @param {Array} tasks - The array of tasks to display in the modal.
     */
    function renderTasksInFilteredModal(tasks) {
        filteredTasksList.innerHTML = ''; // Clear existing tasks in the modal

        if (tasks.length === 0) {
            filteredTasksList.innerHTML = '<p class="text-gray-400 text-center text-sm col-span-full">No tasks found matching your filters.</p>';
            showModal(filteredTasksModal);
            return;
        }

        tasks.forEach(task => {
            const categoryName = task.category && task.category.name ? task.category.name : 'Uncategorized';
            const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Due Date';

            const taskCard = document.createElement('div');
            taskCard.className = `task-card priority-${task.priority.toLowerCase()}`;
            taskCard.dataset.taskId = task._id;
            taskCard.draggable = true;
            taskCard.innerHTML = `
                <h4 class="text-lg font-semibold mb-2">${task.title}</h4>
                <p class="text-gray-300 text-sm mb-2">${task.description || 'No description'}</p>
                <div class="task-meta text-xs">
                    <span class="font-medium">Category: <span class="text-purple-300">${categoryName}</span></span>
                    <span class="font-medium">Priority: <span class="priority-text">${task.priority}</span></span>
                    <span class="font-medium w-full text-right md:text-left mt-1 md:mt-0">Due: <span class="text-blue-300">${dueDateText}</span></span>
                </div>
                <div class="mt-4 flex justify-end space-x-2">
                    <button data-id="${task._id}" class="edit-task-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md text-sm shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button data-id="${task._id}" class="delete-task-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md text-sm shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            filteredTasksList.appendChild(taskCard);
        });

        // Attach event listeners to new edit/delete task buttons within the modal
        document.querySelectorAll('#filtered-tasks-list .edit-task-btn').forEach(button => {
            button.addEventListener('click', handleEditTask);
        });
        document.querySelectorAll('#filtered-tasks-list .delete-task-btn').forEach(button => {
            button.addEventListener('click', handleDeleteTask);
        });
        document.querySelectorAll('#filtered-tasks-list .task-card').forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });
        showModal(filteredTasksModal); // Show the modal once populated
    }

    // --- Drag and Drop Handlers ---
    function handleDragStart(e) {
        draggedTaskId = e.target.dataset.taskId;
        e.dataTransfer.setData('text/plain', draggedTaskId); // Set data to be transferred
        e.target.classList.add('dragging'); // Add dragging style
        console.log('Dragging task:', draggedTaskId);
        // Hide filtered tasks modal if it's open and dragging from there
        if (!filteredTasksModal.classList.contains('hidden')) {
            hideModal(filteredTasksModal);
        }
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging'); // Remove dragging style
        draggedTaskId = null;
        // Remove drag-over highlights from all categories
        document.querySelectorAll('.category-button').forEach(btn => {
            btn.classList.remove('drag-over');
        });
    }

    function handleCategoryDragOver(e) {
        e.preventDefault(); // Necessary to allow a drop
        const targetCategoryButton = e.target.closest('.category-button');
        if (targetCategoryButton) {
            targetCategoryButton.classList.add('drag-over'); // Highlight drop target
        }
    }

    function handleCategoryDragLeave(e) {
        const targetCategoryButton = e.target.closest('.category-button');
        if (targetCategoryButton) {
            targetCategoryButton.classList.remove('drag-over'); // Remove highlight
        }
    }

    async function handleCategoryDrop(e) {
        e.preventDefault();
        const dropTargetCategoryButton = e.target.closest('.category-button');
        if (!dropTargetCategoryButton) return; // Not a category button

        dropTargetCategoryButton.classList.remove('drag-over'); // Remove highlight
        
        if (!draggedTaskId) return; // No task being dragged

        const newCategoryId = dropTargetCategoryButton.dataset.categoryId;

        if (newCategoryId === 'all') {
            showToast('Cannot move a task to "All Tasks". Please drop it on a specific category.', 'info');
            return;
        }

        const taskToUpdate = currentTasks.find(task => task._id === draggedTaskId);
        if (!taskToUpdate) {
            // If task not found in currentTasks, it might be in filteredTasksModal's temporary state
            // Re-fetch currentTasks (all tasks for the user) and try again or show error
            showToast('Dragged task not found in main list. Refreshing data...', 'info');
            await fetchTasks(false); // Refetch all tasks to ensure currentTasks is up-to-date
            const reFetchedTask = currentTasks.find(task => task._id === draggedTaskId);
            if (!reFetchedTask) {
                showToast('Dragged task still not found after refresh.', 'error');
                return;
            }
            taskToUpdate = reFetchedTask;
        }

        // Check if the task is already in this category
        const currentTaskCategoryId = taskToUpdate.category && taskToUpdate.category._id ? taskToUpdate.category._id : taskToUpdate.category;
        if (currentTaskCategoryId === newCategoryId) {
            showToast('Task is already in this category!', 'info');
            return;
        }

        // Prepare the task data to send, ensuring all required fields are present
        const updatedTaskData = {
            title: taskToUpdate.title,
            description: taskToUpdate.description,
            dueDate: taskToUpdate.dueDate,
            priority: taskToUpdate.priority,
            category: newCategoryId,
            completed: taskToUpdate.completed
        };

        // Perform the API call to update the task's category
        try {
            const response = await fetch(`/api/tasks/${draggedTaskId}`, {
                method: 'PUT',
                headers: getAuthHeaders(), // Include auth headers
                body: JSON.stringify(updatedTaskData) 
            });
            const data = await response.json();

            if (response.ok) {
                showToast(`Task "${taskToUpdate.title}" moved to new category!`, 'success');
                // After successful move, refresh the main task list
                fetchTasks(false); 
                // Close the filtered tasks modal if it was open during the drag
                hideModal(filteredTasksModal);
            } else {
                showToast(data.message || 'Failed to move task.', 'error');
            }
        } catch (error) {
            console.error('Error moving task:', error);
            showToast('Network error while moving task.', 'error');
        } finally {
            draggedTaskId = null; // Clear dragged task ID
        }
    }


    // --- Authentication Flow ---

    /**
     * Handles successful user login.
     * @param {object} authData - Object containing token and username.
     */
    function handleLoginSuccess(authData) {
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('username', authData.username); // Store username
        localStorage.setItem('token', authData.token);     // Store JWT token

        if (authSection) authSection.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');

        userGreeting.textContent = `Hello, ${localStorage.getItem('username') || 'User'}!`;

        showToast('Login successful! Welcome to TaskFlow.', 'success');
        fetchCategories(); // This will fetch tasks after categories are rendered
    }

    /**
     * Handles user logout.
     */
    function handleLogout() {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('token'); // Clear JWT token
        if (authSection) authSection.classList.remove('hidden');
        if (appSection) appSection.classList.add('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        showToast('You have been logged out.', 'info');
        currentCategories = [];
        currentTasks = [];
        activeCategoryId = 'all';
        renderCategories();
        renderTasks();
    }

    // --- Event Handlers ---

    // Toggle between login and register forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        registerForm.reset();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        loginForm.reset();
    });

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target['login-username'].value;
        const password = e.target['login-password'].value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: getAuthHeaders(), // No token yet, but sets content-type
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                handleLoginSuccess(data); // Pass the data (including token and username)
            } else {
                showToast(data.message || 'Login failed.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Network error during login. Please try again.', 'error');
        }
    });

    // Registration Form Submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target['register-username'].value;
        const password = e.target['register-password'].value;
        const confirmPassword = e.target['register-confirm-password'].value;

        if (password !== confirmPassword) {
            showToast('Passwords do not match!', 'error');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: getAuthHeaders(), // No token yet, but sets content-type
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                registerForm.reset();
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                loginForm['login-username'].value = username;
                // Optionally auto-login after successful registration, if desired
                handleLoginSuccess(data); // UNCOMMENTED THIS LINE
            } else {
                showToast(data.message || 'Registration failed.', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showToast('Network error during registration. Please try again.', 'error');
        }
    });

    // Logout button in header
    logoutBtnHeader.addEventListener('click', () => {
        handleLogout();
    });

    // New Task Button in header
    newTaskBtnHeader.addEventListener('click', () => {
        if (newTaskBtnHeader.disabled) {
            showToast('Please create at least one category before creating a task.', 'info');
            return;
        }
        taskModalTitle.textContent = 'New Task';
        taskForm.reset();
        taskForm.dataset.taskId = ''; // Clear ID for new task
        taskDueDateInput.value = ''; // Clear due date input for new task
        populateCategorySelect();
        showModal(taskModal);
    });

    // Manage Categories Button in header
    manageCategoriesBtn.addEventListener('click', () => {
        newCategoryForm.reset();
        renderExistingCategoriesList();
        showModal(categoryManagementModal);
    });

    // Close Modals (applies to all modals using .close-modal-btn)
    document.querySelectorAll('.close-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            hideModal(e.target.closest('.modal-overlay'));
        });
    });

    // New Category Form Submission (within Management Modal)
    newCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newCategoryNameInput.value.trim();
        if (!name) {
            showToast('Category name cannot be empty.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: getAuthHeaders(), // Include auth headers
                body: JSON.stringify({ name })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                newCategoryNameInput.value = ''; // Clear input specifically
                fetchCategories();
            } else {
                showToast(data.message || 'Failed to create category.', 'error');
            }
        } catch (error) {
            console.error('New category form submission error:', error);
            showToast('Network error during category creation.', 'error');
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout();
            }
        }
    });

    // Delete Category (from anywhere it's rendered, now centralized)
    async function handleDeleteCategory(e) {
        e.stopPropagation();
        const categoryId = e.target.dataset.id || e.target.closest('button').dataset.id;
        const categoryElement = e.target.closest('.category-button') || e.target.closest('.category-item');
        const categoryName = categoryElement.querySelector('span') ? categoryElement.querySelector('span').textContent : 'this category';

        const confirmed = await showConfirmation(`Are you sure you want to delete "${categoryName}"? All associated tasks will also be deleted.`);
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE',
                headers: getAuthHeaders() // Include auth headers
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                if (activeCategoryId === categoryId) {
                    setActiveCategory('all');
                }
                fetchCategories();
            } else {
                showToast(data.message || 'Failed to delete category.', 'error');
            }
        } catch (error) {
            console.error('Delete category error:', error);
            showToast('Network error during category deletion.', 'error');
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout();
            }
        }
    }

    // Task Form Submission (Create/Edit)
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskTitleInput.value.trim();
        const description = taskDescriptionTextarea.value.trim();
        const dueDate = taskDueDateInput.value; // Get due date value
        const priority = taskPrioritySelect.value;
        const category = taskCategorySelect.value;
        const taskId = taskForm.dataset.taskId;

        if (!title || !category) {
            showToast('Task title and category are required.', 'error');
            return;
        }

        const taskData = { title, description, dueDate, priority, category }; // Include dueDate
        let response;

        try {
            if (taskId) {
                response = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(), // Include auth headers
                    body: JSON.stringify(taskData)
                });
            } else {
                response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: getAuthHeaders(), // Include auth headers
                    body: JSON.stringify(taskData)
                });
            }

            const data = await response.json();
            if (response.ok) {
                showToast(data.message, 'success');
                hideModal(taskModal);
                taskForm.reset();
                fetchTasks(false); // Refresh main task list
            } else {
                showToast(data.message || 'Operation failed.', 'error');
            }
        } catch (error) {
            console.error('Task form submission error:', error);
            showToast('Network error during task operation.', 'error');
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout();
            }
        }
    });

    // Edit Task Handler
    async function handleEditTask(e) {
        const taskId = e.target.closest('button').dataset.id;
        const taskToEdit = currentTasks.find(task => task._id === taskId) || 
                             (filteredTasksList.contains(e.target.closest('.task-card')) && 
                              Array.from(filteredTasksList.children).find(card => card.dataset.taskId === taskId && card.taskData)); // Check filtered tasks data
        
        // Fallback: If task not found in current views, refetch all tasks and try again
        if (!taskToEdit) {
            showToast('Task not found in current view. Fetching latest data...', 'info');
            await fetchTasks(false); // Refetch all tasks
            taskToEdit = currentTasks.find(task => task._id === taskId);
        }

        if (taskToEdit) {
            console.log('Editing task:', taskToEdit);
            taskModalTitle.textContent = 'Edit Task';
            taskTitleInput.value = taskToEdit.title;
            taskDescriptionTextarea.value = taskToEdit.description;
            taskDueDateInput.value = taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : '';
            taskPrioritySelect.value = taskToEdit.priority;
            
            populateCategorySelect();
            const categoryIdToSelect = taskToEdit.category && taskToEdit.category._id ? taskToEdit.category._id : taskToEdit.category;
            taskCategorySelect.value = categoryIdToSelect;
            console.log('Attempting to set taskCategorySelect value to:', categoryIdToSelect);
            console.log('Current taskCategorySelect value after setting:', taskCategorySelect.value);

            taskForm.dataset.taskId = taskId;
            showModal(taskModal);
        } else {
            showToast('Task not found for editing.', 'error');
        }
    }

    // Delete Task Handler
    async function handleDeleteTask(e) {
        const taskId = e.target.closest('button').dataset.id;
        const taskCardElement = e.target.closest('.task-card');
        const taskTitle = taskCardElement ? taskCardElement.querySelector('h4').textContent : 'this task';


        const confirmed = await showConfirmation(`Are you sure you want to delete the task "${taskTitle}"?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: getAuthHeaders() // Include auth headers
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                fetchTasks(false); // Refresh main tasks after deletion
                // If the filtered modal is open, ensure it also reflects the deletion
                if (!filteredTasksModal.classList.contains('hidden')) {
                    hideModal(filteredTasksModal); // Close it and let user re-filter if desired
                }
            } else {
                showToast(data.message || 'Failed to delete task.', 'error');
            }
        } catch (error) {
            console.error('Delete task error:', error);
            showToast('Network error during task deletion.', 'error');
            if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
                handleLogout();
            }
        }
    }

    // Search and Filter Handlers - Now triggers modal display
    applyFilterBtn.addEventListener('click', () => {
        fetchTasks(true); // Indicate that search/date filters should be applied
    });

    // Optional: Add 'Enter' key listener for search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchTasks(true); // Indicate that search/date filters should be applied
        }
    });

    // Placeholder for Settings button (no functionality yet)
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showToast('Settings functionality is not yet implemented.', 'info');
        });
    }

    // --- Initial Check on Load ---
    // Check if the user was previously logged in and has a token
    if (localStorage.getItem('loggedIn') === 'true' && localStorage.getItem('token')) {
        // Attempt to verify token by fetching categories; if token invalid, will trigger logout
        fetchCategories(); 
    }
});
