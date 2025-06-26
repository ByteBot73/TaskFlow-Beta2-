// server.js

// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const express = require('express');
const path = require('path');
const mongoose = require('mongoose'); // Import Mongoose
// const bcrypt = require('bcryptjs'); // For password hashing
// const jwt = require('jsonwebtoken'); // For JSON Web Tokens

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 3000;
const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/taskmanager'; // MongoDB URI
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbeverylongandrandom';

// --- Database Connection ---
mongoose.connect(DB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas ---

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true } // In production, this should store a hashed password
}, { timestamps: true }); // Add createdAt and updatedAt fields

// Pre-save hook to hash password (uncomment when bcryptjs is used)
// userSchema.pre('save', async function(next) {
//     if (this.isModified('password')) {
//         this.password = await bcrypt.hash(this.password, 10);
//     }
//     next();
// });

const User = mongoose.model('User', userSchema);

// Category Schema
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);

// Task Schema
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, default: null }, // Added due date field
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completed: { type: Boolean, default: false }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// --- Middleware ---
app.use(express.json()); // Parses incoming JSON payloads
app.use(express.static(path.join(__dirname, 'public'))); // Serves static files

// --- Authentication Middleware (Placeholder for JWT) ---
function authenticateToken(req, res, next) {
    const mockUserId = process.env.MOCK_USER_ID || '667be2d3a2b3c4d5e6f7a8b9'; // REPLACE THIS WITH A REAL USER ID FROM YOUR DB AFTER REGISTRATION

    if (!mongoose.Types.ObjectId.isValid(mockUserId)) {
        console.error('Invalid mock user ID format. Please use a valid ObjectId string. Ensure a user has been registered and its ID is set in .env or hardcoded temporarily.');
        return res.status(401).json({ message: 'Authentication required. Please log in or register to get a valid user session.' });
    }
    req.userId = new mongoose.Types.ObjectId(mockUserId);
    console.log('Authentication Middleware: req.userId set to', req.userId); // Debugging line
    next();
}

// --- Helper for Date Filtering ---
function getDatesForFilter(filter) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day

    let startDate, endDate;

    switch (filter) {
        case 'today':
            startDate = new Date(now);
            endDate = new Date(now);
            endDate.setDate(endDate.getDate() + 1); // Up to end of today (exclusive)
            break;
        case 'this-week':
            const dayOfWeek = now.getDay(); // Sunday is 0, Saturday is 6
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek); // Go to start of Sunday
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7); // Go to end of Saturday (exclusive)
            break;
        case 'upcoming':
            startDate = new Date(now); // From today onwards (inclusive)
            // No endDate means any date in the future
            break;
        case 'overdue':
            endDate = new Date(now); // Any date before today (exclusive)
            // No startDate means any date in the past
            break;
        default:
            return {}; // No date filter
    }

    const dateQuery = {};
    if (startDate) {
        dateQuery.$gte = startDate;
    }
    if (endDate) {
        dateQuery.$lt = endDate;
    }
    return dateQuery;
}


// --- Routes ---

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken.' });
        }

        const user = new User({ username, password }); // Password will be hashed by pre-save hook
        await user.save();

        // After successful registration, if you want this user to be the 'mock' user for testing
        // You can set it in the process.env.MOCK_USER_ID
        // This is for development convenience without full JWT.
        if (!process.env.MOCK_USER_ID) {
             process.env.MOCK_USER_ID = user._id.toString();
             console.log('Registered user ID set as MOCK_USER_ID for testing:', process.env.MOCK_USER_ID);
        }

        res.status(201).json({ message: 'Registration successful! Please log in.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // --- IMPORTANT: MOCK PASSWORD CHECK ---
        // In production, use bcrypt.compare(password, user.password)
        const isMatch = (password === user.password); // MOCK: direct comparison
        // const isMatch = await bcrypt.compare(password, user.password); // REAL: use bcrypt

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        process.env.MOCK_USER_ID = user._id.toString(); // Update mock user ID on successful login
        console.log('User logged in. MOCK_USER_ID updated to:', process.env.MOCK_USER_ID);

        res.status(200).json({ message: 'Login successful (mock).' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Categories API (Protected Routes)
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await Category.find({ userId: req.userId });
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Failed to retrieve categories.' });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Category name is required.' });
    }
    try {
        const category = new Category({ name, userId: req.userId });
        await category.save();
        res.status(201).json({ message: 'Category created successfully!', category });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Failed to create category.' });
    }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid category ID.' });
    }

    try {
        const category = await Category.findOneAndDelete({ _id: id, userId: req.userId });
        if (!category) {
            return res.status(404).json({ message: 'Category not found or not authorized.' });
        }

        await Task.deleteMany({ category: id, userId: req.userId });

        res.status(200).json({ message: 'Category and associated tasks deleted successfully!' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Failed to delete category.' });
    }
});

// Tasks API (Protected Routes)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { search, dueDate } = req.query;
        let query = { userId: req.userId };

        // Apply search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Apply due date filter
        if (dueDate) {
            const dateFilter = getDatesForFilter(dueDate);
            if (Object.keys(dateFilter).length > 0) {
                query.dueDate = dateFilter;
            }
            if (dueDate === 'overdue') {
                query.completed = false; // Only show overdue if not completed
            }
        }

        console.log('MongoDB Query (after filters):', JSON.stringify(query)); // Debugging line: Log the constructed query

        const tasks = await Task.find(query).populate('category', 'name').sort({ dueDate: 1, createdAt: -1 }); // Sort by due date
        console.log('Tasks retrieved from DB:', tasks.length, 'tasks'); // Debugging line: Log how many tasks were retrieved
        if (tasks.length > 0) {
            console.log('Sample of retrieved tasks details (first 3):', tasks.slice(0, 3)); // Log first few tasks for inspection
        }

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Failed to retrieve tasks.' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, priority, category, dueDate } = req.body;
    if (!title || !category || !mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Title and a valid category are required.' });
    }

    try {
        const existingCategory = await Category.findOne({ _id: category, userId: req.userId });
        if (!existingCategory) {
            return res.status(404).json({ message: 'Category not found or not authorized.' });
        }

        const task = new Task({
            title,
            description,
            dueDate: dueDate ? new Date(dueDate) : null, // Convert to Date object
            priority,
            category,
            userId: req.userId
        });
        await task.save();

        await task.populate('category', 'name');
        res.status(201).json({ message: 'Task created successfully!', task });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Failed to create task.' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, description, priority, category, completed, dueDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid task ID.' });
    }

    try {
        // If category is being updated, verify it belongs to the user
        if (category && !mongoose.Types.ObjectId.isValid(category)) {
             return res.status(400).json({ message: 'Invalid category ID format.' });
        }
        if (category) {
            const existingCategory = await Category.findOne({ _id: category, userId: req.userId });
            if (!existingCategory) {
                return res.status(404).json({ message: 'Category not found or not authorized.' });
            }
        }


        const updateData = {
            title,
            description,
            priority,
            category,
            completed,
            dueDate: dueDate ? new Date(dueDate) : null // Convert to Date object
        };

        // Remove undefined fields from updateData so Mongoose doesn't try to set them to undefined
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);


        const task = await Task.findOneAndUpdate(
            { _id: id, userId: req.userId },
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name');

        if (!task) {
            return res.status(404).json({ message: 'Task not found or not authorized.' });
        }

        res.status(200).json({ message: 'Task updated successfully!', task });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Failed to update task.' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid task ID.' });
    }

    try {
        const task = await Task.findOneAndDelete({ _id: id, userId: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found or not authorized.' });
        }
        res.status(200).json({ message: 'Task deleted successfully!' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
