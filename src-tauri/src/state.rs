use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Persistent pet settings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PetSettings {
    /// Whether the window ignores cursor events (click-through).
    pub click_through: bool,
    /// Minimum interval between speech-bubble messages, in milliseconds.
    pub message_freq_ms: u32,
}

impl Default for PetSettings {
    fn default() -> Self {
        Self {
            click_through: false,
            message_freq_ms: 45_000,
        }
    }
}

/// Full persistent pet state, serialized to `pet-state.json` in the app data dir.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PetState {
    /// Satiety 0..100.
    pub satiety: f64,
    /// Mood 0..100.
    pub mood: f64,
    /// Intimacy 0..100.
    pub intimacy: f64,
    /// Sleepiness 0..100.
    pub sleepiness: f64,
    /// ISO8601 timestamp of the last time the state was seen.
    pub last_seen_at: String,
    pub settings: PetSettings,
    /// Schema version, currently 1.
    pub version: u32,
}

impl Default for PetState {
    fn default() -> Self {
        Self {
            satiety: 80.0,
            mood: 70.0,
            intimacy: 0.0,
            sleepiness: 20.0,
            last_seen_at: Utc::now().to_rfc3339(),
            settings: PetSettings::default(),
            version: 1,
        }
    }
}

/// Compute the path of the pet-state file within the app data directory.
pub fn state_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("pet-state.json")
}

/// Load the pet state from disk, falling back to defaults on any error.
#[tauri::command]
pub fn load_state(app: AppHandle) -> PetState {
    let Ok(data_dir) = app.path().app_data_dir() else {
        log::warn!("failed to resolve app data dir; using default pet state");
        return PetState::default();
    };
    let path = state_file_path(&data_dir);
    let Ok(contents) = std::fs::read_to_string(&path) else {
        // Missing file is the normal first-run case.
        return PetState::default();
    };
    match serde_json::from_str::<PetState>(&contents) {
        Ok(state) if state.version == 1 => state,
        Ok(state) => {
            log::warn!(
                "pet-state.json has unsupported version {}; using defaults",
                state.version
            );
            PetState::default()
        }
        Err(e) => {
            log::warn!("failed to parse pet-state.json: {e}; using defaults");
            PetState::default()
        }
    }
}

/// Persist the pet state to disk as pretty-printed JSON.
#[tauri::command]
pub fn save_state(app: AppHandle, state: PetState) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let path = state_file_path(&data_dir);
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_has_expected_values() {
        let state = PetState::default();
        assert_eq!(state.satiety, 80.0);
        assert_eq!(state.mood, 70.0);
        assert_eq!(state.intimacy, 0.0);
        assert_eq!(state.sleepiness, 20.0);
        assert_eq!(state.version, 1);
        assert!(!state.settings.click_through);
        assert_eq!(state.settings.message_freq_ms, 45_000);
        assert!(!state.last_seen_at.is_empty());
    }

    #[test]
    fn serde_roundtrip_preserves_fields() {
        let state = PetState {
            satiety: 55.5,
            mood: 42.0,
            intimacy: 12.25,
            sleepiness: 88.0,
            last_seen_at: "2026-09-08T10:00:00Z".to_string(),
            settings: PetSettings {
                click_through: true,
                message_freq_ms: 30_000,
            },
            version: 1,
        };
        let json = serde_json::to_string(&state).expect("serialize");
        let decoded: PetState = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(decoded, state);
    }

    #[test]
    fn serde_uses_camel_case_keys() {
        let state = PetState::default();
        let json = serde_json::to_string(&state).expect("serialize");
        assert!(json.contains("\"lastSeenAt\""), "got: {json}");
        assert!(json.contains("\"messageFreqMs\""), "got: {json}");
        assert!(json.contains("\"clickThrough\""), "got: {json}");
    }

    #[test]
    fn file_roundtrip_via_state_file_path() {
        let dir = std::env::temp_dir().join(format!(
            "healing-pet-state-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = state_file_path(&dir);

        let state = PetState {
            satiety: 33.0,
            mood: 66.0,
            intimacy: 99.0,
            sleepiness: 11.0,
            last_seen_at: "2026-09-08T12:00:00Z".to_string(),
            settings: PetSettings {
                click_through: true,
                message_freq_ms: 60_000,
            },
            version: 1,
        };
        let json = serde_json::to_string_pretty(&state).expect("serialize");
        std::fs::write(&path, json).expect("write file");

        let contents = std::fs::read_to_string(&path).expect("read file");
        let decoded: PetState = serde_json::from_str(&contents).expect("deserialize");
        assert_eq!(decoded, state);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
