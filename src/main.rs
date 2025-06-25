use gtk4::prelude::*;
use gtk4::{
    Application, ApplicationWindow, Box, Button, Entry, Label, ListBox, ListBoxRow,
    Orientation, ScrolledWindow, SelectionMode, HeaderBar, Dialog, ComboBoxText,
    ResponseType, CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, Calendar
};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::fs;
use std::path::PathBuf;
use std::rc::Rc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActivityEntry {
    date: String,
    action: String,
    details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JobApplication {
    id: u32,
    company: String,
    position: String,
    status: String,
    date_applied: String,
    notes: String,
    #[serde(default)]
    activity_history: Vec<ActivityEntry>,
}

impl JobApplication {
    fn status_priority(&self) -> u8 {
        match self.status.as_str() {
            "Interview" => 0,
            "Offer" => 1,
            "Applied" => 2,
            "Rejected" => 3,
            "Withdrawn" => 4,
            _ => 5,
        }
    }
}

struct AppState {
    applications: Vec<JobApplication>,
    next_id: u32,
}

impl AppState {
    fn new() -> Self {
        Self {
            applications: Vec::new(),
            next_id: 1,
        }
    }

    fn load(&mut self) {
        let data_path = Self::get_data_path();
        if data_path.exists() {
            if let Ok(data) = fs::read_to_string(&data_path) {
                if let Ok(apps) = serde_json::from_str::<Vec<JobApplication>>(&data) {
                    self.applications = apps;
                    self.next_id = self.applications.iter().map(|a| a.id).max().unwrap_or(0) + 1;
                }
            }
        }
    }

    fn save(&self) {
        let data_path = Self::get_data_path();
        if let Some(parent) = data_path.parent() {
            fs::create_dir_all(parent).ok();
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.applications) {
            fs::write(data_path, data).ok();
        }
    }

    fn get_data_path() -> PathBuf {
        let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("job-tracker");
        path.push("applications.json");
        path
    }

    fn add_application(&mut self, company: String, position: String, date_applied: String) -> JobApplication {
        let mut activity_history = Vec::new();
        activity_history.push(ActivityEntry {
            date: date_applied.clone(),
            action: "Applied".to_string(),
            details: format!("Applied to {} for {}", company, position),
        });

        let app = JobApplication {
            id: self.next_id,
            company,
            position,
            status: "Applied".to_string(),
            date_applied,
            notes: String::new(),
            activity_history,
        };
        self.applications.push(app.clone());
        self.next_id += 1;
        self.save();
        app
    }

    fn update_status(&mut self, id: u32, status: String) {
        if let Some(app) = self.applications.iter_mut().find(|a| a.id == id) {
            let old_status = app.status.clone();
            if old_status != status {
                app.status = status.clone();
                app.activity_history.push(ActivityEntry {
                    date: chrono::Local::now().format("%Y-%m-%d").to_string(),
                    action: format!("Status changed to {}", status),
                    details: format!("Changed from {} to {}", old_status, status),
                });
                self.save();
            }
        }
    }

    fn update_notes(&mut self, id: u32, notes: String) {
        if let Some(app) = self.applications.iter_mut().find(|a| a.id == id) {
            app.notes = notes;
            self.save();
        }
    }

    fn delete_application(&mut self, id: u32) {
        self.applications.retain(|a| a.id != id);
        self.save();
    }
}

fn main() {
    let app = Application::builder()
        .application_id("com.example.jobtracker")
        .build();

    app.connect_activate(build_ui);
    app.run();
}

fn build_ui(app: &Application) {
    let state = Rc::new(RefCell::new(AppState::new()));
    state.borrow_mut().load();

    // Main window
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Jobowl")
        .default_width(800)
        .default_height(600)
        .build();

    // Header bar
    let header_bar = HeaderBar::new();
    header_bar.set_title_widget(Some(&Label::new(Some("Jobowl"))));
    window.set_titlebar(Some(&header_bar));

    // Main container
    let main_box = Box::new(Orientation::Vertical, 10);
    main_box.set_margin_top(10);
    main_box.set_margin_bottom(10);
    main_box.set_margin_start(10);
    main_box.set_margin_end(10);

    // Add new application section
    let add_box = Box::new(Orientation::Horizontal, 5);
    let company_entry = Entry::new();
    company_entry.set_placeholder_text(Some("Company name"));
    company_entry.set_hexpand(true);
    
    let position_entry = Entry::new();
    position_entry.set_placeholder_text(Some("Position"));
    position_entry.set_hexpand(true);
    
    let selected_date = Rc::new(RefCell::new(chrono::Local::now().format("%Y-%m-%d").to_string()));
    let date_button = Button::with_label(&selected_date.borrow().clone());
    date_button.set_tooltip_text(Some("Click to select date"));
    date_button.set_width_request(120);
    
    let add_button = Button::with_label("Add Application");
    add_button.add_css_class("suggested-action");

    add_box.append(&company_entry);
    add_box.append(&position_entry);
    add_box.append(&date_button);
    add_box.append(&add_button);

    // List container
    let scrolled_window = ScrolledWindow::new();
    scrolled_window.set_vexpand(true);
    scrolled_window.set_min_content_height(400);

    let list_box = ListBox::new();
    list_box.set_selection_mode(SelectionMode::None);
    list_box.add_css_class("boxed-list");
    scrolled_window.set_child(Some(&list_box));

    // Load custom CSS
    let css = CssProvider::new();
    css.load_from_data(
        r#"
        .job-row {
            padding: 10px;
            border-radius: 5px;
            margin: 2px;
        }
        .job-row:hover {
            background-color: alpha(currentColor, 0.07);
        }
        .status-applied { color: #3584e4; }
        .status-interview { color: #ff7800; }
        .status-offer { color: #33d17a; }
        .status-rejected { color: #e01b24; }
        .status-withdrawn { color: #9a9996; }
        "#
    );
    
    gtk4::style_context_add_provider_for_display(
        &gtk4::gdk::Display::default().expect("Could not connect to a display"),
        &css,
        STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    // Populate list
    let state_clone = state.clone();
    let list_box_clone = list_box.clone();
    let refresh_list = move || {
        while let Some(child) = list_box_clone.first_child() {
            list_box_clone.remove(&child);
        }

        let mut sorted_apps = state_clone.borrow().applications.clone();
        sorted_apps.sort_by_key(|app| app.status_priority());

        for app in &sorted_apps {
            let row = create_job_row(app, &state_clone, &list_box_clone);
            list_box_clone.append(&row);
        }
    };

    refresh_list();

    // Date button click handler
    let date_button_clone = date_button.clone();
    let selected_date_clone = selected_date.clone();
    let window_clone = window.clone();
    date_button.connect_clicked(move |_| {
        show_date_picker_dialog(&window_clone, {
            let date_button = date_button_clone.clone();
            let selected_date = selected_date_clone.clone();
            move |new_date: String| {
                selected_date.replace(new_date.clone());
                date_button.set_label(&new_date);
            }
        });
    });

    // Add button click handler
    let state_clone = state.clone();
    let company_entry_clone = company_entry.clone();
    let position_entry_clone = position_entry.clone();
    let selected_date_clone = selected_date.clone();
    let date_button_clone = date_button.clone();
    let refresh_list_clone = refresh_list.clone();
    add_button.connect_clicked(move |_| {
        let company = company_entry_clone.text().to_string();
        let position = position_entry_clone.text().to_string();
        let date_applied = selected_date_clone.borrow().clone();
        
        if !company.is_empty() && !position.is_empty() && !date_applied.is_empty() {
            state_clone.borrow_mut().add_application(company, position, date_applied);
            company_entry_clone.set_text("");
            position_entry_clone.set_text("");
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            selected_date_clone.replace(today.clone());
            date_button_clone.set_label(&today);
            refresh_list_clone();
        }
    });

    // Assemble UI
    main_box.append(&add_box);
    main_box.append(&scrolled_window);
    window.set_child(Some(&main_box));
    window.present();
}

fn create_job_row(app: &JobApplication, state: &Rc<RefCell<AppState>>, list_box: &ListBox) -> ListBoxRow {
    let row = ListBoxRow::new();
    row.set_selectable(false);
    
    let row_box = Box::new(Orientation::Horizontal, 10);
    row_box.add_css_class("job-row");
    
    // Left side - job info
    let info_box = Box::new(Orientation::Vertical, 5);
    info_box.set_hexpand(true);
    
    let company_label = Label::new(Some(&format!("<b>{}</b>", app.company)));
    company_label.set_use_markup(true);
    company_label.set_halign(gtk4::Align::Start);
    
    let position_label = Label::new(Some(&app.position));
    position_label.set_halign(gtk4::Align::Start);
    
    let date_label = Label::new(Some(&format!("Applied: {}", app.date_applied)));
    date_label.set_halign(gtk4::Align::Start);
    date_label.add_css_class("dim-label");
    
    info_box.append(&company_label);
    info_box.append(&position_label);
    info_box.append(&date_label);
    
    // Status combo box
    let status_combo = ComboBoxText::new();
    status_combo.append_text("Applied");
    status_combo.append_text("Interview");
    status_combo.append_text("Offer");
    status_combo.append_text("Rejected");
    status_combo.append_text("Withdrawn");
    
    match app.status.as_str() {
        "Applied" => status_combo.set_active(Some(0)),
        "Interview" => status_combo.set_active(Some(1)),
        "Offer" => status_combo.set_active(Some(2)),
        "Rejected" => status_combo.set_active(Some(3)),
        "Withdrawn" => status_combo.set_active(Some(4)),
        _ => status_combo.set_active(Some(0)),
    }
    
    let status_class = format!("status-{}", app.status.to_lowercase());
    status_combo.add_css_class(&status_class);
    
    // Action buttons
    let action_box = Box::new(Orientation::Horizontal, 5);
    
    let notes_button = Button::with_label("Notes");
    let delete_button = Button::with_label("Delete");
    delete_button.add_css_class("destructive-action");
    
    action_box.append(&notes_button);
    action_box.append(&delete_button);
    
    // Status change handler
    let state_clone = state.clone();
    let app_id = app.id;
    let status_combo_clone = status_combo.clone();
    let list_box_clone = list_box.clone();
    status_combo.connect_changed(move |combo| {
        if let Some(text) = combo.active_text() {
            state_clone.borrow_mut().update_status(app_id, text.to_string());
            
            // Update CSS class
            for i in 0..5 {
                let class = format!("status-{}", ["applied", "interview", "offer", "rejected", "withdrawn"][i]);
                status_combo_clone.remove_css_class(&class);
            }
            let new_class = format!("status-{}", text.to_lowercase());
            status_combo_clone.add_css_class(&new_class);
            
            // Refresh list with sorting
            while let Some(child) = list_box_clone.first_child() {
                list_box_clone.remove(&child);
            }
            let mut sorted_apps = state_clone.borrow().applications.clone();
            sorted_apps.sort_by_key(|app| app.status_priority());
            for app in &sorted_apps {
                let row = create_job_row(app, &state_clone, &list_box_clone);
                list_box_clone.append(&row);
            }
        }
    });
    
    // Notes button handler
    let state_clone = state.clone();
    let app_clone = app.clone();
    notes_button.connect_clicked(move |button| {
        if let Some(window) = button.root().and_then(|r| r.downcast::<ApplicationWindow>().ok()) {
            show_notes_dialog(&window, &app_clone, &state_clone);
        }
    });
    
    // Delete button handler
    let state_clone = state.clone();
    let app_id = app.id;
    let list_box_clone = list_box.clone();
    delete_button.connect_clicked(move |_| {
        state_clone.borrow_mut().delete_application(app_id);
        
        // Refresh list with sorting
        while let Some(child) = list_box_clone.first_child() {
            list_box_clone.remove(&child);
        }
        let mut sorted_apps = state_clone.borrow().applications.clone();
        sorted_apps.sort_by_key(|app| app.status_priority());
        for app in &sorted_apps {
            let row = create_job_row(app, &state_clone, &list_box_clone);
            list_box_clone.append(&row);
        }
    });
    
    // Assemble row
    row_box.append(&info_box);
    row_box.append(&status_combo);
    row_box.append(&action_box);
    row.set_child(Some(&row_box));
    
    row
}

fn show_date_picker_dialog<F>(window: &ApplicationWindow, callback: F) 
where 
    F: Fn(String) + 'static,
{
    let dialog = Dialog::builder()
        .title("Select Date")
        .transient_for(window)
        .modal(true)
        .default_width(300)
        .default_height(280)
        .build();
    
    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("Select", ResponseType::Accept);
    
    let content_area = dialog.content_area();
    content_area.set_margin_top(10);
    content_area.set_margin_bottom(10);
    content_area.set_margin_start(10);
    content_area.set_margin_end(10);
    
    let calendar = Calendar::new();
    content_area.append(&calendar);
    
    dialog.connect_response(move |dialog, response| {
        if response == ResponseType::Accept {
            let date = calendar.date();
            let date_str = format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day_of_month());
            callback(date_str);
        }
        dialog.close();
    });
    
    dialog.present();
}

fn show_notes_dialog(window: &ApplicationWindow, app: &JobApplication, state: &Rc<RefCell<AppState>>) {
    let dialog = Dialog::builder()
        .title(&format!("Notes & History - {} at {}", app.position, app.company))
        .transient_for(window)
        .modal(true)
        .default_width(500)
        .default_height(400)
        .build();
    
    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("Save", ResponseType::Accept);
    
    let content_area = dialog.content_area();
    content_area.set_margin_top(10);
    content_area.set_margin_bottom(10);
    content_area.set_margin_start(10);
    content_area.set_margin_end(10);
    
    let main_box = Box::new(Orientation::Vertical, 10);
    
    // Notes section
    let notes_label = Label::new(Some("<b>Notes:</b>"));
    notes_label.set_use_markup(true);
    notes_label.set_halign(gtk4::Align::Start);
    
    let notes_entry = gtk4::TextView::new();
    notes_entry.buffer().set_text(&app.notes);
    
    let notes_scrolled = ScrolledWindow::new();
    notes_scrolled.set_child(Some(&notes_entry));
    notes_scrolled.set_min_content_height(100);
    
    // Activity history section
    let history_label = Label::new(Some("<b>Activity History:</b>"));
    history_label.set_use_markup(true);
    history_label.set_halign(gtk4::Align::Start);
    
    let history_text = gtk4::TextView::new();
    history_text.set_editable(false);
    history_text.set_cursor_visible(false);
    
    let mut history_content = String::new();
    for entry in &app.activity_history {
        history_content.push_str(&format!("{} - {}: {}\n", entry.date, entry.action, entry.details));
    }
    history_text.buffer().set_text(&history_content);
    
    let history_scrolled = ScrolledWindow::new();
    history_scrolled.set_child(Some(&history_text));
    history_scrolled.set_min_content_height(150);
    
    main_box.append(&notes_label);
    main_box.append(&notes_scrolled);
    main_box.append(&history_label);
    main_box.append(&history_scrolled);
    
    content_area.append(&main_box);
    
    let state_clone = state.clone();
    let app_id = app.id;
    dialog.connect_response(move |dialog, response| {
        if response == ResponseType::Accept {
            let buffer = notes_entry.buffer();
            let start = buffer.start_iter();
            let end = buffer.end_iter();
            let notes = buffer.text(&start, &end, false).to_string();
            state_clone.borrow_mut().update_notes(app_id, notes);
        }
        dialog.close();
    });
    
    dialog.present();
}