use crate::models::JobApplication;
use crate::app_state::AppState;
use crate::dialogs::DialogManager;
use gtk4::prelude::*;
use gtk4::{
    ApplicationWindow, Button, Entry, Label, ListBox, ListBoxRow, ScrolledWindow,
    ComboBoxText, Box as GtkBox, Orientation, CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION,
    GestureClick
};
use std::cell::RefCell;
use std::rc::Rc;

pub struct JobRowBuilder;

impl JobRowBuilder {
    pub fn create_job_row<F>(app: &JobApplication, state: &Rc<RefCell<AppState>>, refresh_callback: F) -> ListBoxRow 
    where
        F: Fn() + Clone + 'static,
    {
        let row = ListBoxRow::new();
        row.set_selectable(true);
        row.set_activatable(true);
        
        let row_box = GtkBox::new(Orientation::Horizontal, 10);
        row_box.add_css_class("job-row");
        
        // Left side - job info
        let info_box = GtkBox::new(Orientation::Vertical, 5);
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
        
        // Status badge
        let status_label = Label::new(Some(&app.status));
        let status_class = format!("status-{}", app.status.to_lowercase());
        status_label.add_css_class(&status_class);
        status_label.add_css_class("status-badge");
        status_label.set_halign(gtk4::Align::End);
        status_label.set_valign(gtk4::Align::Center);
        
        // Assemble row
        row_box.append(&info_box);
        row_box.append(&status_label);
        row.set_child(Some(&row_box));
        
        // Click handler to open detail dialog
        let state_clone = state.clone();
        let app_clone = app.clone();
        let refresh_callback_clone = refresh_callback.clone();
        
        // Use both activate signal and button press for maximum compatibility
        row.connect_activate({
            let state_clone = state_clone.clone();
            let app_clone = app_clone.clone();
            let refresh_callback_clone = refresh_callback_clone.clone();
            move |row| {
                if let Some(window) = row.root().and_then(|r| r.downcast::<ApplicationWindow>().ok()) {
                    DialogManager::show_job_detail(&window, &app_clone, &state_clone, refresh_callback_clone.clone());
                }
            }
        });
        
        // Also add a gesture click controller as backup
        let gesture = GestureClick::new();
        gesture.connect_pressed({
            let state_clone = state_clone.clone();
            let app_clone = app_clone.clone();
            let refresh_callback_clone = refresh_callback_clone.clone();
            move |gesture, _n_press, _x, _y| {
                println!("Gesture click for: {} at {}", app_clone.position, app_clone.company);
                let widget = gesture.widget();
                if let Some(row_widget) = widget.ancestor(gtk4::ListBoxRow::static_type()) {
                    if let Ok(row) = row_widget.downcast::<gtk4::ListBoxRow>() {
                        if let Some(window) = row.root().and_then(|r| r.downcast::<ApplicationWindow>().ok()) {
                            println!("Found window via gesture, showing dialog");
                            DialogManager::show_job_detail(&window, &app_clone, &state_clone, refresh_callback_clone.clone());
                        }
                    }
                }
            }
        });
        row.add_controller(gesture);
        
        row
    }
}

pub struct SearchFilterBar {
    pub container: GtkBox,
    pub search_entry: Entry,
    pub status_filter: ComboBoxText,
    pub add_button: Button,
}

impl SearchFilterBar {
    pub fn new() -> Self {
        let container = GtkBox::new(Orientation::Horizontal, 10);
        
        let search_entry = Entry::new();
        search_entry.set_placeholder_text(Some("Search applications..."));
        search_entry.set_hexpand(true);
        
        let status_filter = ComboBoxText::new();
        status_filter.append_text("All Status");
        status_filter.append_text("Applied");
        status_filter.append_text("Interview");
        status_filter.append_text("Offer");
        status_filter.append_text("Rejected");
        status_filter.append_text("Withdrawn");
        status_filter.set_active(Some(0));
        
        let add_button = Button::with_label("+ Add Application");
        add_button.add_css_class("suggested-action");

        container.append(&search_entry);
        container.append(&status_filter);
        container.append(&add_button);

        Self {
            container,
            search_entry,
            status_filter,
            add_button,
        }
    }

    pub fn connect_search_changed<F>(&self, callback: F)
    where
        F: Fn() + 'static,
    {
        self.search_entry.connect_changed(move |_| {
            callback();
        });
    }

    pub fn connect_filter_changed<F>(&self, callback: F)
    where
        F: Fn() + 'static,
    {
        self.status_filter.connect_changed(move |_| {
            callback();
        });
    }

    pub fn connect_add_clicked<F>(&self, callback: F)
    where
        F: Fn() + 'static,
    {
        self.add_button.connect_clicked(move |_| {
            callback();
        });
    }

    pub fn get_search_text(&self) -> String {
        self.search_entry.text().to_string()
    }

    pub fn get_filter_status(&self) -> String {
        self.status_filter.active_text()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "All Status".to_string())
    }
}

pub struct JobListView {
    pub container: ScrolledWindow,
    pub list_box: ListBox,
}

impl JobListView {
    pub fn new() -> Self {
        let container = ScrolledWindow::new();
        container.set_vexpand(true);
        container.set_min_content_height(400);

        let list_box = ListBox::new();
        list_box.set_selection_mode(gtk4::SelectionMode::Single);
        list_box.add_css_class("boxed-list");
        container.set_child(Some(&list_box));

        Self {
            container,
            list_box,
        }
    }

    pub fn clear(&self) {
        while let Some(child) = self.list_box.first_child() {
            self.list_box.remove(&child);
        }
    }

    pub fn add_job_row(&self, row: ListBoxRow) {
        self.list_box.append(&row);
    }

    pub fn populate_jobs<F>(&self, apps: &[JobApplication], state: &Rc<RefCell<AppState>>, refresh_callback: F)
    where
        F: Fn() + Clone + 'static,
    {
        self.clear();
        for app in apps {
            let row = JobRowBuilder::create_job_row(app, state, refresh_callback.clone());
            self.add_job_row(row);
        }
    }
}

pub struct StyleManager;

impl StyleManager {
    pub fn load_styles() {
        let css = CssProvider::new();
        css.load_from_data(
            r#"
            .job-row {
                padding: 10px;
                border-radius: 5px;
                margin: 2px;
                cursor: pointer;
            }
            .job-row:hover {
                background-color: alpha(currentColor, 0.07);
            }
            .status-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.85em;
                font-weight: bold;
                color: white;
            }
            .status-applied { background-color: #3584e4; }
            .status-interview { background-color: #ff7800; }
            .status-offer { background-color: #33d17a; }
            .status-rejected { background-color: #e01b24; }
            .status-withdrawn { background-color: #9a9996; }
            "#
        );
        
        gtk4::style_context_add_provider_for_display(
            &gtk4::gdk::Display::default().expect("Could not connect to a display"),
            &css,
            STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
}