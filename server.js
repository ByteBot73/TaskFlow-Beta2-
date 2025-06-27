require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET; // Make sure this is set in Render's environment variables
const MONGODB_URI = process.env.MONGODB_URI; // Make sure this is set in Render's environment variables

// Middleware
app.use(express.json()); // For parsing application/json
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// CORS configuration (for development, adjust for production)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Adjust this in production to your frontend URL
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error: Check MONGODB_URI environment variable.', err.message);
        // Exit process if DB connection fails
        process.exit(1); 
    });

// --- Mongoose Schemas ---

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: false }, // Category names can be duplicated across users
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to user
    createdAt: { type: Date, default: Date.now }
});
// Ensure a user cannot have duplicate category names
categorySchema.index({ name: 1, userId: 1 }, { unique: true });


const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to user
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update `updatedAt` field on save
taskSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Task = mongoose.model('Task', taskSchema);

// --- Authentication Middleware ---
const verifyToken = (req, res, next) => {
    // Check for token in x-auth-token header (or Authorization: Bearer token)
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.header('x-auth-token');

    console.log('--- verifyToken middleware ---');
    console.log('Received Auth Header:', authHeader || 'None');
    console.log('Extracted Token (first 10 chars):', token ? token.substring(0, 10) + '...' : 'No Token Extracted');

    if (!token) {
        console.log('verifyToken: No token provided in headers.');
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (!JWT_SECRET) {
        console.error('verifyToken: JWT_SECRET environment variable is not defined on the server!');
        // This might indicate a missing .env variable on Render.
        return res.status(500).json({ message: 'Server configuration error: JWT secret not found.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        console.log('verifyToken: Token successfully verified for userId:', req.userId);
        next();
    } catch (err) {
        console.error('verifyToken: Token verification failed. Error:', err.message);
        // Log the actual JWT_SECRET length for debugging, but not the secret itself
        console.error('JWT_SECRET length:', JWT_SECRET.length);
        res.status(401).json({ message: 'Token is not valid' });
    }
    console.log('--- End verifyToken middleware ---');
};

// --- Routes ---

// @route   POST /api/register
// @desc    Register a new user
// @access  Public
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ username, password: hashedPassword });
        await user.save();

        const payload = { userId: user.id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }); // Increased expiry for easier testing

        res.status(201).json({ message: 'User registered successfully!', token, username: user.username });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// @route   POST /api/login
// @desc    Authenticate user & get token
// @access  Public
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = { userId: user.id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }); // Increased expiry for easier testing

        res.json({ message: 'Logged in successfully!', token, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- Category Routes ---

// @route   POST /api/categories
// @desc    Create a new category for the authenticated user
// @access  Private
app.post('/api/categories', verifyToken, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.userId; // Get userId from authenticated token

        // Check if user already has a category with this name
        const existingCategory = await Category.findOne({ name, userId });
        if (existingCategory) {
            return res.status(400).json({ message: 'You already have a category with this name.' });
        }

        const newCategory = new Category({ name, userId });
        await newCategory.save();
        res.status(201).json({ message: 'Category created successfully!', category: newCategory });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   GET /api/categories
// @desc    Get all categories for the authenticated user
// @access  Private
app.get('/api/categories', verifyToken, async (req, res) => {
    try {
        // Fetch only categories belonging to the authenticated user
        const categories = await Category.find({ userId: req.userId }).sort({ createdAt: 1 });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error fetching categories.' });
    }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category by ID for the authenticated user
// @access  Private
app.delete('/api/categories/:id', verifyToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const userId = req.userId;

        // Find and delete the category, ensuring it belongs to the user
        const category = await Category.findOneAndDelete({ _id: categoryId, userId: userId });

        if (!category) {
            return res.status(404).json({ message: 'Category not found or not authorized to delete.' });
        }

        // Also delete all tasks associated with this category and user
        await Task.deleteMany({ category: categoryId, userId: userId });

        res.json({ message: 'Category and associated tasks deleted successfully!' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Server error deleting category.' });
    }
});


// --- Task Routes ---

// @route   POST /api/tasks
// @desc    Create a new task for the authenticated user
// @access  Private
app.post('/api/tasks', verifyToken, async (req, res) => {
    try {
        const { title, description, dueDate, priority, category } = req.body;
        const userId = req.userId; // Get userId from authenticated token

        // Validate if the category exists and belongs to the user
        const existingCategory = await Category.findOne({ _id: category, userId: userId });
        if (!existingCategory) {
            return res.status(400).json({ message: 'Invalid category or category not found for your account.' });
        }

        const newTask = new Task({ title, description, dueDate, priority, category, userId });
        await newTask.save();
        res.status(201).json({ message: 'Task created successfully!', task: newTask });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   GET /api/tasks
// @desc    Get all tasks for the authenticated user, with optional filters
// @access  Private
app.get('/api/tasks', verifyToken, async (req, res) => {
    try {
        const { search, dueDate } = req.query;
        let query = { userId: req.userId }; // ALL queries MUST be scoped by userId

        // Search filter (title or description)
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [{ title: searchRegex }, { description: searchRegex }];
        }

        // Due date filter
        if (dueDate) {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0); // Start of today UTC

            switch (dueDate) {
                case 'today':
                    const tomorrow = new Date(today);
                    tomorrow.setUTCDate(today.getUTCDate() + 1);
                    query.dueDate = { $gte: today.toISOString(), $lt: tomorrow.toISOString() };
                    break;
                case 'this-week': // Sunday to Saturday of current week
                    const firstDayOfWeek = new Date(today);
                    firstDayOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay()); // Go to Sunday
                    firstDayOfWeek.setUTCHours(0, 0, 0, 0);

                    const lastDayOfWeek = new Date(firstDayOfWeek);
                    lastDayOfWeek.setUTCDate(firstDayOfWeek.getUTCDate() + 7); // Go to next Sunday
                    lastDayOfWeek.setUTCHours(0, 0, 0, 0);

                    query.dueDate = { $gte: firstDayOfWeek.toISOString(), $lt: lastDayOfWeek.toISOString() };
                    break;
                case 'upcoming': // From today onwards
                    query.dueDate = { $gte: today.toISOString() };
                    break;
                case 'overdue': // Before today
                    query.dueDate = { $lt: today.toISOString() };
                    break;
                // 'all' is handled by no dueDate filter being applied
            }
        }
        
        console.log('MongoDB Query (after filters):', JSON.stringify(query));
        const tasks = await Task.find(query).populate('category').sort({ createdAt: -1 });
        console.log(`Tasks retrieved from DB: ${tasks.length} tasks`);
        if (tasks.length > 0) {
            console.log('Sample of retrieved tasks details (first 3):', tasks.slice(0, 3).map(t => ({
                _id: t._id,
                title: t.title,
                description: t.description,
                dueDate: t.dueDate,
                priority: t.priority,
                category: t.category ? { _id: t.category._id, name: t.category.name } : 'N/A',
                userId: t.userId,
                completed: t.completed
            })));
        }

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error fetching tasks.' });
    }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task by ID for the authenticated user
// @access  Private
app.put('/api/tasks/:id', verifyToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.userId; // Get userId from authenticated token
        const { title, description, dueDate, priority, category, completed } = req.body;

        // Validate if the new category exists and belongs to the user
        if (category) {
            const existingCategory = await Category.findOne({ _id: category, userId: userId });
            if (!existingCategory) {
                return res.status(400).json({ message: 'Invalid category or category not found for your account.' });
            }
        }

        // Find and update the task, ensuring it belongs to the user
        const updatedTask = await Task.findOneAndUpdate(
            { _id: taskId, userId: userId }, // Query by both _id and userId
            { title, description, dueDate, priority, category, completed, updatedAt: Date.now() },
            { new: true, runValidators: true } // Return the updated document, run schema validators
        ).populate('category');

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found or not authorized to update.' });
        }
        res.json({ message: 'Task updated successfully!', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task by ID for the authenticated user
// @access  Private
app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.userId;

        // Find and delete the task, ensuring it belongs to the user
        const deletedTask = await Task.findOneAndDelete({ _id: taskId, userId: userId });

        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found or not authorized to delete.' });
        }
        res.json({ message: 'Task deleted successfully!' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error deleting task.' });
    }
});

// Catch-all for unhandled routes (optional)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
