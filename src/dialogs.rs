use crate::models::JobApplication;
use crate::app_state::AppState;
use gtk4::prelude::*;
use gtk4::{
    ApplicationWindow, Button, Entry, Label, ScrolledWindow, Dialog, ComboBoxText,
    ResponseType, Calendar, Box as GtkBox, Orientation, TextView
};
use std::cell::RefCell;
use std::rc::Rc;

pub struct DialogManager;

impl DialogManager {
    pub fn show_date_picker<F>(window: &ApplicationWindow, callback: F) 
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

    pub fn show_add_application<F>(window: &ApplicationWindow, state: &Rc<RefCell<AppState>>, refresh_callback: F) 
    where
        F: Fn() + 'static,
    {
        let dialog = Dialog::builder()
            .title("Add New Job Application")
            .transient_for(window)
            .modal(true)
            .default_width(500)
            .default_height(350)
            .build();
        
        dialog.add_button("Cancel", ResponseType::Cancel);
        dialog.add_button("Add Application", ResponseType::Accept);
        
        let content_area = dialog.content_area();
        content_area.set_margin_top(10);
        content_area.set_margin_bottom(10);
        content_area.set_margin_start(10);
        content_area.set_margin_end(10);
        
        let main_box = GtkBox::new(Orientation::Vertical, 15);
        
        // Company input
        let company_box = GtkBox::new(Orientation::Horizontal, 10);
        let company_label = Label::new(Some("Company:"));
        company_label.set_width_request(80);
        company_label.set_halign(gtk4::Align::Start);
        let company_entry = Entry::new();
        company_entry.set_placeholder_text(Some("Enter company name"));
        company_entry.set_hexpand(true);
        company_box.append(&company_label);
        company_box.append(&company_entry);
        
        // Position input
        let position_box = GtkBox::new(Orientation::Horizontal, 10);
        let position_label = Label::new(Some("Position:"));
        position_label.set_width_request(80);
        position_label.set_halign(gtk4::Align::Start);
        let position_entry = Entry::new();
        position_entry.set_placeholder_text(Some("Enter position title"));
        position_entry.set_hexpand(true);
        position_box.append(&position_label);
        position_box.append(&position_entry);
        
        // Date input
        let date_box = GtkBox::new(Orientation::Horizontal, 10);
        let date_label = Label::new(Some("Applied Date:"));
        date_label.set_width_request(80);
        date_label.set_halign(gtk4::Align::Start);
        
        let selected_date = Rc::new(RefCell::new(chrono::Local::now().format("%Y-%m-%d").to_string()));
        let date_button = Button::with_label(&selected_date.borrow().clone());
        date_button.set_tooltip_text(Some("Click to select date"));
        
        // Date picker handler
        let date_button_clone = date_button.clone();
        let selected_date_clone = selected_date.clone();
        let window_clone = window.clone();
        date_button.connect_clicked(move |_| {
            Self::show_date_picker(&window_clone, {
                let date_button = date_button_clone.clone();
                let selected_date = selected_date_clone.clone();
                move |new_date: String| {
                    selected_date.replace(new_date.clone());
                    date_button.set_label(&new_date);
                }
            });
        });
        
        date_box.append(&date_label);
        date_box.append(&date_button);
        
        // Notes input
        let notes_label = Label::new(Some("Notes (optional):"));
        notes_label.set_halign(gtk4::Align::Start);
        
        let notes_entry = TextView::new();
        notes_entry.buffer().set_text("");
        
        let notes_scrolled = ScrolledWindow::new();
        notes_scrolled.set_child(Some(&notes_entry));
        notes_scrolled.set_min_content_height(80);
        notes_scrolled.set_vexpand(true);
        
        main_box.append(&company_box);
        main_box.append(&position_box);
        main_box.append(&date_box);
        main_box.append(&notes_label);
        main_box.append(&notes_scrolled);
        
        content_area.append(&main_box);
        
        // Response handler
        let state_clone = state.clone();
        let company_entry_clone = company_entry.clone();
        let position_entry_clone = position_entry.clone();
        let selected_date_clone = selected_date.clone();
        let notes_entry_clone = notes_entry.clone();
        let refresh_callback_clone = Rc::new(refresh_callback);
        dialog.connect_response(move |dialog, response| {
            if response == ResponseType::Accept {
                let company = company_entry_clone.text().to_string();
                let position = position_entry_clone.text().to_string();
                let date_applied = selected_date_clone.borrow().clone();
                
                if !company.is_empty() && !position.is_empty() && !date_applied.is_empty() {
                    // Get notes
                    let buffer = notes_entry_clone.buffer();
                    let start = buffer.start_iter();
                    let end = buffer.end_iter();
                    let notes = buffer.text(&start, &end, false).to_string();
                    
                    // Create application with notes
                    let app = state_clone.borrow_mut().add_application(company, position, date_applied);
                    if !notes.is_empty() {
                        if let Some(mut app_ref) = state_clone.borrow().get_application(app.id).cloned() {
                            app_ref.update_notes(notes);
                            state_clone.borrow_mut().update_application(app.id, app_ref);
                        }
                    }
                    
                    refresh_callback_clone();
                }
            }
            dialog.close();
        });
        
        dialog.present();
    }

    pub fn show_job_detail<F>(window: &ApplicationWindow, app: &JobApplication, state: &Rc<RefCell<AppState>>, refresh_callback: F) 
    where
        F: Fn() + Clone + 'static,
    {
        let dialog = Dialog::builder()
            .title(&format!("{} at {}", app.position, app.company))
            .transient_for(window)
            .modal(true)
            .default_width(600)
            .default_height(500)
            .build();
        
        dialog.add_button("Close", ResponseType::Close);
        dialog.add_button("Save Changes", ResponseType::Accept);
        
        let content_area = dialog.content_area();
        content_area.set_margin_top(10);
        content_area.set_margin_bottom(10);
        content_area.set_margin_start(10);
        content_area.set_margin_end(10);
        
        let main_box = GtkBox::new(Orientation::Vertical, 15);
        
        // Company and Position (editable)
        let info_box = GtkBox::new(Orientation::Horizontal, 10);
        
        let company_label = Label::new(Some("Company:"));
        company_label.set_width_request(80);
        company_label.set_halign(gtk4::Align::Start);
        let company_entry = Entry::new();
        company_entry.set_text(&app.company);
        company_entry.set_hexpand(true);
        
        let position_label = Label::new(Some("Position:"));
        position_label.set_width_request(80);
        position_label.set_halign(gtk4::Align::Start);
        let position_entry = Entry::new();
        position_entry.set_text(&app.position);
        position_entry.set_hexpand(true);
        
        info_box.append(&company_label);
        info_box.append(&company_entry);
        info_box.append(&position_label);
        info_box.append(&position_entry);
        
        // Date and Status
        let status_box = GtkBox::new(Orientation::Horizontal, 10);
        
        let date_label = Label::new(Some(&format!("Applied: {}", app.date_applied)));
        date_label.set_halign(gtk4::Align::Start);
        
        let status_label = Label::new(Some("Status:"));
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
        
        status_box.append(&date_label);
        status_box.append(&status_label);
        status_box.append(&status_combo);
        
        // Notes section
        let notes_label = Label::new(Some("<b>Notes:</b>"));
        notes_label.set_use_markup(true);
        notes_label.set_halign(gtk4::Align::Start);
        
        let notes_entry = TextView::new();
        notes_entry.buffer().set_text(&app.notes);
        
        let notes_scrolled = ScrolledWindow::new();
        notes_scrolled.set_child(Some(&notes_entry));
        notes_scrolled.set_min_content_height(120);
        notes_scrolled.set_vexpand(true);
        
        // Activity history section
        let history_label = Label::new(Some("<b>Activity History:</b>"));
        history_label.set_use_markup(true);
        history_label.set_halign(gtk4::Align::Start);
        
        let history_text = TextView::new();
        history_text.set_editable(false);
        history_text.set_cursor_visible(false);
        
        let mut history_content = String::new();
        for entry in &app.activity_history {
            history_content.push_str(&format!("{} - {}: {}\n", entry.date, entry.action, entry.details));
        }
        history_text.buffer().set_text(&history_content);
        
        let history_scrolled = ScrolledWindow::new();
        history_scrolled.set_child(Some(&history_text));
        history_scrolled.set_min_content_height(100);
        
        // Delete button
        let button_box = GtkBox::new(Orientation::Horizontal, 10);
        button_box.set_halign(gtk4::Align::End);
        let delete_button = Button::with_label("Delete Application");
        delete_button.add_css_class("destructive-action");
        button_box.append(&delete_button);
        
        main_box.append(&info_box);
        main_box.append(&status_box);
        main_box.append(&notes_label);
        main_box.append(&notes_scrolled);
        main_box.append(&history_label);
        main_box.append(&history_scrolled);
        main_box.append(&button_box);
        
        content_area.append(&main_box);
        
        // Delete button handler
        let state_clone = state.clone();
        let app_id = app.id;
        let dialog_clone = dialog.clone();
        let refresh_callback_clone = refresh_callback.clone();
        delete_button.connect_clicked(move |_| {
            state_clone.borrow_mut().delete_application(app_id);
            refresh_callback_clone();
            dialog_clone.close();
        });
        
        // Save changes handler
        let state_clone = state.clone();
        let app_id = app.id;
        let company_entry_clone = company_entry.clone();
        let position_entry_clone = position_entry.clone();
        let status_combo_clone = status_combo.clone();
        let notes_entry_clone = notes_entry.clone();
        let refresh_callback_clone = refresh_callback.clone();
        dialog.connect_response(move |dialog, response| {
            if response == ResponseType::Accept {
                let app_opt = state_clone.borrow().get_application(app_id).cloned();
                if let Some(mut app) = app_opt {
                    // Update basic info
                    let company = company_entry_clone.text().to_string();
                    let position = position_entry_clone.text().to_string();
                    app.update_info(company, position);
                    
                    // Update status
                    if let Some(new_status) = status_combo_clone.active_text() {
                        app.update_status(new_status.to_string());
                    }
                    
                    // Update notes
                    let buffer = notes_entry_clone.buffer();
                    let start = buffer.start_iter();
                    let end = buffer.end_iter();
                    let notes = buffer.text(&start, &end, false).to_string();
                    app.update_notes(notes);
                    
                    state_clone.borrow_mut().update_application(app_id, app);
                    refresh_callback_clone();
                }
            }
            dialog.close();
        });
        
        dialog.present();
    }
}