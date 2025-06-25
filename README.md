# JobOwl

A GTK4-based job application tracker built with Rust.

## Features

- **Add Applications**: Track job applications with company name and position
- **Status Management**: Update application status (Applied, Interview, Offer, Rejected, Withdrawn)
- **Notes**: Add detailed notes for each application
- **Persistent Storage**: Automatically saves data to `~/.config/job-tracker/applications.json`
- **Modern UI**: Clean GTK4 interface with color-coded status indicators

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

1. **Adding Applications**: Enter company name and position in the top fields, then click "Add Application"
2. **Updating Status**: Use the dropdown menu to change application status
3. **Adding Notes**: Click the "Notes" button to add detailed information about each application
4. **Deleting Applications**: Click the "Delete" button to remove applications

## Data Storage

Application data is automatically saved to:
- Linux: `~/.config/job-tracker/applications.json`
- Windows: `%APPDATA%\job-tracker\applications.json`
- macOS: `~/Library/Application Support/job-tracker/applications.json`

## Dependencies

- `gtk4` - GTK4 bindings for Rust
- `serde` - Serialization framework
- `serde_json` - JSON support for serde
- `dirs` - Cross-platform directory paths
- `chrono` - Date and time handling

## License

This project is open source. Please add your preferred license.