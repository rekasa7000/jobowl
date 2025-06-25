# JobOwl

A modern desktop job application tracker built with Rust and GTK4. JobOwl helps you manage your job search with an intuitive interface featuring clickable job listings, detailed application modals, and comprehensive tracking capabilities.

## Features

### 🎯 **Modern Interface**
- **Clickable Job Rows**: Click any job application to view detailed information
- **Modal Dialogs**: Edit applications, add notes, and manage details in dedicated windows
- **Search & Filter**: Real-time search and status-based filtering at the top of the interface
- **Date Picker**: Intuitive calendar widget for selecting application dates
- **Status Badges**: Color-coded status indicators for quick visual reference

### 📊 **Application Management**
- **Add Applications**: Modal-based application creation with all details
- **Status Tracking**: Update status (Applied, Interview, Offer, Rejected, Withdrawn) with automatic sorting
- **Activity History**: Automatic tracking of all status changes and modifications
- **Notes System**: Rich text notes for each application with full editing capabilities
- **Delete Protection**: Safe deletion from within the detail modal

### 💾 **Data & Organization**
- **Persistent Storage**: Automatic saving to JSON format
- **Smart Sorting**: Applications sorted by status priority (Interview → Offer → Applied → Rejected → Withdrawn)
- **Search Functionality**: Search across company names, positions, and notes
- **Status Filtering**: Filter applications by current status

## Prerequisites

- Rust (latest stable version)
- GTK4 development libraries

### Installing GTK4 on Linux

**Ubuntu/Debian:**
```bash
sudo apt install libgtk-4-dev build-essential
```

**Fedora:**
```bash
sudo dnf install gtk4-devel gcc
```

**Arch Linux:**
```bash
sudo pacman -S gtk4 base-devel
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jobowl
```

2. Build and run:
```bash
cargo run
```

## Usage

### Getting Started
1. **Launch JobOwl**: Run `cargo run` to start the application
2. **Add Your First Application**: Click the "+ Add Application" button in the top toolbar

### Managing Applications
1. **Add New Applications**: 
   - Click "+ Add Application" button
   - Fill in company name, position, and select application date using the date picker
   - Optionally add notes in the text area
   - Click "Add Application" to save

2. **View & Edit Applications**:
   - Click on any job application row to open the detail modal
   - Edit company name, position, status, and notes
   - View complete activity history of status changes
   - Click "Save Changes" to update or "Delete Application" to remove

3. **Search & Filter**:
   - Use the search bar to find applications by company, position, or notes
   - Use the status dropdown to filter by application status
   - Applications are automatically sorted by status priority

4. **Track Progress**:
   - Monitor the activity history in each application's detail view
   - Status changes are automatically logged with timestamps
   - Color-coded status badges provide quick visual feedback

## Data Storage

Application data is automatically saved to:
- Linux: `~/.config/job-tracker/applications.json`
- Windows: `%APPDATA%\job-tracker\applications.json`
- macOS: `~/Library/Application Support/job-tracker/applications.json`

## Architecture

JobOwl is built with a modular architecture for maintainability and extensibility:

```
src/
├── main.rs          # Application entry point and GTK4 setup
├── models.rs        # Data structures (JobApplication, ActivityEntry)
├── app_state.rs     # State management and data persistence
├── dialogs.rs       # Modal dialog management (add, edit, date picker)
└── ui.rs           # UI components (job rows, search bar, styling)
```

### Key Components
- **Models**: Business logic and data structures with proper serialization
- **App State**: Centralized state management with CRUD operations
- **Dialogs**: Modal-based user interactions for all editing operations
- **UI Components**: Reusable widgets and styling management

## Dependencies

- `gtk4` - GTK4 bindings for Rust GUI framework
- `serde` & `serde_json` - JSON serialization for data persistence
- `dirs` - Cross-platform directory paths for data storage
- `chrono` - Date and time handling for activity tracking

## Contributing

JobOwl is built with modern Rust practices and GTK4. Contributions are welcome! Please ensure:
- Code follows the existing modular architecture
- New features include appropriate error handling
- UI changes maintain accessibility and usability standards

## License

This project is open source. Please add your preferred license.