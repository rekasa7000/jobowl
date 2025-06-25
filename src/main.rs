mod models;
mod app_state;
mod dialogs;
mod ui;

use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, HeaderBar, Label, Box as GtkBox, Orientation};
use std::cell::RefCell;
use std::rc::Rc;

use app_state::AppState;
use dialogs::DialogManager;
use ui::{SearchFilterBar, JobListView, StyleManager, JobRowBuilder};

struct JobOwlApp {
    state: Rc<RefCell<AppState>>,
}

impl JobOwlApp {
    fn new() -> Self {
        let mut state = AppState::new();
        state.load();
        
        // Add some test data if no applications exist
        if state.get_applications().is_empty() {
            state.add_application("Google".to_string(), "Software Engineer".to_string(), "2024-01-15".to_string());
            state.add_application("Microsoft".to_string(), "Senior Developer".to_string(), "2024-01-20".to_string());
            state.add_application("Apple".to_string(), "iOS Developer".to_string(), "2024-01-25".to_string());
        }
        
        let state = Rc::new(RefCell::new(state));

        Self { state }
    }

    fn build_ui(&self, app: &Application) {
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
        let main_box = GtkBox::new(Orientation::Vertical, 10);
        main_box.set_margin_top(10);
        main_box.set_margin_bottom(10);
        main_box.set_margin_start(10);
        main_box.set_margin_end(10);

        // Load styles
        StyleManager::load_styles();

        // Create UI components
        let search_filter_bar = SearchFilterBar::new();
        let job_list_view = JobListView::new();

        // Setup refresh callback using Rc<RefCell> to handle recursion
        let refresh_callback: Rc<RefCell<Option<Box<dyn Fn()>>>> = Rc::new(RefCell::new(None));
        let refresh_callback_clone = refresh_callback.clone();
        
        let refresh_fn = {
            let state = self.state.clone();
            let search_entry = search_filter_bar.search_entry.clone();
            let status_filter = search_filter_bar.status_filter.clone();
            let list_box = job_list_view.list_box.clone();
            let refresh_callback = refresh_callback.clone();
            
            move || {
                let search_text = search_entry.text().to_string();
                let filter_status = status_filter.active_text()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "All Status".to_string());
                
                let apps = state.borrow().get_filtered_applications(&search_text, &filter_status);
                
                // Clear existing rows
                while let Some(child) = list_box.first_child() {
                    list_box.remove(&child);
                }
                
                // Add new rows with proper callback
                for app in &apps {
                    let refresh_inner = {
                        let refresh_callback = refresh_callback.clone();
                        move || {
                            if let Some(refresh) = refresh_callback.borrow().as_ref() {
                                refresh();
                            }
                        }
                    };
                    
                    let row = JobRowBuilder::create_job_row(app, &state, refresh_inner);
                    list_box.append(&row);
                }
            }
        };
        
        *refresh_callback_clone.borrow_mut() = Some(Box::new(refresh_fn));

        // Initial population
        if let Some(refresh) = refresh_callback.borrow().as_ref() {
            refresh();
        }

        // Connect search and filter handlers
        search_filter_bar.connect_search_changed({
            let refresh_callback = refresh_callback.clone();
            move || {
                if let Some(refresh) = refresh_callback.borrow().as_ref() {
                    refresh();
                }
            }
        });

        search_filter_bar.connect_filter_changed({
            let refresh_callback = refresh_callback.clone();
            move || {
                if let Some(refresh) = refresh_callback.borrow().as_ref() {
                    refresh();
                }
            }
        });

        // Connect add button handler
        search_filter_bar.connect_add_clicked({
            let state = self.state.clone();
            let window_clone = window.clone();
            let refresh_callback = refresh_callback.clone();
            
            move || {
                let refresh_fn = {
                    let refresh_callback = refresh_callback.clone();
                    move || {
                        if let Some(refresh) = refresh_callback.borrow().as_ref() {
                            refresh();
                        }
                    }
                };
                DialogManager::show_add_application(&window_clone, &state, refresh_fn);
            }
        });

        // Assemble UI
        main_box.append(&search_filter_bar.container);
        main_box.append(&job_list_view.container);
        window.set_child(Some(&main_box));
        window.present();
    }
}

fn main() {
    let app = Application::builder()
        .application_id("com.example.jobowl")
        .build();

    app.connect_activate(|app| {
        let job_owl_app = JobOwlApp::new();
        job_owl_app.build_ui(app);
    });

    app.run();
}