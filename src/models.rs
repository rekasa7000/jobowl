use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub date: String,
    pub action: String,
    pub details: String,
}

impl ActivityEntry {
    pub fn new(date: String, action: String, details: String) -> Self {
        Self { date, action, details }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobApplication {
    pub id: u32,
    pub company: String,
    pub position: String,
    pub status: String,
    pub date_applied: String,
    pub notes: String,
    #[serde(default)]
    pub activity_history: Vec<ActivityEntry>,
}

impl JobApplication {
    pub fn new(id: u32, company: String, position: String, date_applied: String) -> Self {
        let mut activity_history = Vec::new();
        activity_history.push(ActivityEntry::new(
            date_applied.clone(),
            "Applied".to_string(),
            format!("Applied to {} for {}", company, position),
        ));

        Self {
            id,
            company,
            position,
            status: "Applied".to_string(),
            date_applied,
            notes: String::new(),
            activity_history,
        }
    }

    pub fn status_priority(&self) -> u8 {
        match self.status.as_str() {
            "Interview" => 0,
            "Offer" => 1,
            "Applied" => 2,
            "Rejected" => 3,
            "Withdrawn" => 4,
            _ => 5,
        }
    }

    pub fn add_activity(&mut self, action: String, details: String) {
        let now = chrono::Local::now().format("%Y-%m-%d").to_string();
        self.activity_history.push(ActivityEntry::new(now, action, details));
    }

    pub fn update_status(&mut self, new_status: String) {
        if self.status != new_status {
            let old_status = self.status.clone();
            self.status = new_status.clone();
            self.add_activity(
                format!("Status changed to {}", new_status),
                format!("Changed from {} to {}", old_status, new_status),
            );
        }
    }

    pub fn update_notes(&mut self, notes: String) {
        self.notes = notes;
    }

    pub fn update_info(&mut self, company: String, position: String) {
        self.company = company;
        self.position = position;
    }

    pub fn matches_search(&self, search_text: &str) -> bool {
        if search_text.is_empty() {
            return true;
        }
        let search_lower = search_text.to_lowercase();
        self.company.to_lowercase().contains(&search_lower)
            || self.position.to_lowercase().contains(&search_lower)
            || self.notes.to_lowercase().contains(&search_lower)
    }

    pub fn matches_status_filter(&self, filter_status: &str) -> bool {
        filter_status == "All Status" || self.status == filter_status
    }
}