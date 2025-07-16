# UFAZIEN

A modern full-stack web application built with Django REST Framework and React, featuring a comprehensive blog system, dashboard, and various productivity applications.

## 🚀 Project Overview

UFAZIEN is a multi-purpose platform that combines:
- **Blog System**: Rich text editor with image support, categories, and tags
- **Dashboard**: User-friendly interface with various productivity apps
- **Authentication**: Secure user registration and login system
- **Productivity Tools**: GPA calculator, average calculator, calendar, and more

## 🛠️ Tech Stack

### Backend
- **Django 4.x**: Python web framework
- **Django REST Framework**: API development
- **SQLite**: Database (development)
- **Python 3.12**: Programming language

### Frontend
- **React 18**: JavaScript library for UI
- **Vite**: Build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Axios**: HTTP client
- **React Router**: Client-side routing

### Additional Tools
- **TipTap**: Rich text editor for blog posts
- **DOMPurify**: HTML sanitization
- **ESLint**: Code linting

## 📁 Project Structure

```
ufazien/
├── backend/                 # Django backend
│   ├── api/                # Main API app
│   │   ├── models.py       # Database models
│   │   ├── views.py        # API views
│   │   ├── urls.py         # URL routing
│   │   └── migrations/     # Database migrations
│   ├── ufazien/           # Django project settings
│   │   ├── settings.py     # Project configuration
│   │   ├── urls.py         # Main URL configuration
│   │   └── wsgi.py         # WSGI configuration
│   ├── db.sqlite3         # SQLite database
│   ├── manage.py          # Django management script
│   └── schema.yml         # API schema documentation
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   │   └── ui/        # UI components (buttons, inputs, etc.)
│   │   ├── pages/         # Page components
│   │   │   ├── apps/      # Application pages
│   │   │   │   └── blog/  # Blog-related pages
│   │   │   └── auth/      # Authentication pages
│   │   ├── utils/         # Utility functions
│   │   └── assets/        # Static assets
│   ├── public/            # Public static files
│   ├── package.json       # Node.js dependencies
│   ├── vite.config.js     # Vite configuration
│   └── eslint.config.js   # ESLint configuration
├── api_design.md          # API design documentation
└── README.md              # This file
```

## 🚦 Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 16+**
- **npm or yarn**

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   ```bash
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

4. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run database migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Create a superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

7. **Start the Django development server:**
   ```bash
   python manage.py runserver
   ```

The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

The frontend application will be available at `http://localhost:5173`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

### Django Settings

The Django settings are configured in `backend/ufazien/settings.py`. Key configurations include:

- **CORS settings** for frontend-backend communication
- **Media files** configuration for image uploads
- **Database** configuration (SQLite for development)

## 📱 Features

### Blog System
- **Rich Text Editor**: TipTap-powered editor with formatting options
- **Image Upload**: Support for image uploads with alignment options
- **Categories & Tags**: Organize blog posts with categories and tags
- **SEO Optimization**: Meta descriptions, reading time calculation
- **Content Processing**: HTML sanitization and content enhancement

### Dashboard
- **User Authentication**: Secure login/signup system
- **Productivity Apps**: 
  - GPA Calculator
  - Average Calculator
  - Calendar
  - Community features

### UI/UX
- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Dark Mode**: Toggle between light and dark themes
- **Modern Interface**: Clean and intuitive user interface

## 🧪 Development

### Running Tests

**Backend:**
```bash
cd backend
python manage.py test
```

**Frontend:**
```bash
cd frontend
npm run test
```

### Code Linting

**Frontend:**
```bash
cd frontend
npm run lint
```

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```

## 📚 API Documentation

The API schema is available in `backend/schema.yml`. Key endpoints include:

- **Authentication**: `/api/auth/`
- **Blog Posts**: `/api/blog/posts/`
- **Categories**: `/api/blog/categories/`
- **Tags**: `/api/blog/tags/`
- **User Profile**: `/api/profile/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Fuad Alizada** - *Initial work* - [GitHub](https://github.com/martian58)

## 🙏 Acknowledgments

- Django and React communities for excellent documentation
- TailwindCSS for the amazing utility-first CSS framework
- TipTap for the rich text editor
- All contributors and users of this project

## 📞 Support

If you have any questions or need help, please:

1. Check the [Issues](https://github.com/yourusername/ufazien/issues) page
2. Create a new issue if your problem isn't already listed
3. Contact the maintainers

---

**Happy coding!** 🎉
