use crate::models::JobApplication;
use std::fs;
use std::path::PathBuf;

pub struct AppState {
    applications: Vec<JobApplication>,
    next_id: u32,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            applications: Vec::new(),
            next_id: 1,
        }
    }

    pub fn load(&mut self) {
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

    pub fn save(&self) {
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

    pub fn add_application(&mut self, company: String, position: String, date_applied: String) -> JobApplication {
        let app = JobApplication::new(self.next_id, company, position, date_applied);
        self.applications.push(app.clone());
        self.next_id += 1;
        self.save();
        app
    }

    pub fn update_application(&mut self, id: u32, updated_app: JobApplication) {
        if let Some(app) = self.applications.iter_mut().find(|a| a.id == id) {
            *app = updated_app;
            self.save();
        }
    }

    pub fn delete_application(&mut self, id: u32) {
        self.applications.retain(|a| a.id != id);
        self.save();
    }

    pub fn get_application(&self, id: u32) -> Option<&JobApplication> {
        self.applications.iter().find(|a| a.id == id)
    }

    pub fn get_applications(&self) -> &Vec<JobApplication> {
        &self.applications
    }

    pub fn get_filtered_applications(&self, search_text: &str, status_filter: &str) -> Vec<JobApplication> {
        let mut filtered: Vec<JobApplication> = self.applications
            .iter()
            .filter(|app| {
                app.matches_search(search_text) && app.matches_status_filter(status_filter)
            })
            .cloned()
            .collect();
        
        filtered.sort_by_key(|app| app.status_priority());
        filtered
    }
}