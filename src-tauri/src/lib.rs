mod irs;
mod license;
mod pdf;
mod store;

use std::path::PathBuf;
use tauri::Manager;

struct AppState {
    db_path: PathBuf,
    data_dir: PathBuf,
}

// ────────────────────────────────────────────────────────────────────────────
// IRS search + detail commands
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn search_irs(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<irs::SearchResult>, String> {
    irs::search(&state.db_path, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn fetch_provision(
    state: tauri::State<'_, AppState>,
    provision_id: String,
) -> Result<Option<irs::ProvisionDetail>, String> {
    irs::fetch_provision(&state.db_path, &provision_id)
}

#[tauri::command]
fn fetch_form(
    state: tauri::State<'_, AppState>,
    canonical: String,
    parent_form: Option<String>,
) -> Result<Option<irs::FormDetail>, String> {
    irs::fetch_form(&state.db_path, &canonical, parent_form.as_deref())
}

#[tauri::command]
fn fetch_publication(
    state: tauri::State<'_, AppState>,
    pub_number: String,
) -> Result<Option<irs::PubDetail>, String> {
    irs::fetch_publication(&state.db_path, &pub_number)
}

// ────────────────────────────────────────────────────────────────────────────
// Persistence (unchanged)
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn store_read(state: tauri::State<'_, AppState>, name: String) -> Result<Option<String>, String> {
    store::read(&state.data_dir, &name)
}

#[tauri::command]
fn store_write(
    state: tauri::State<'_, AppState>,
    name: String,
    content: String,
) -> Result<(), String> {
    store::write(&state.data_dir, &name, &content)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("failed to write file: {e}"))
}

#[tauri::command]
fn export_pdf(
    path: String,
    title: String,
    entries: Vec<pdf::ExportEntry>,
) -> Result<(), String> {
    pdf::export(&path, &title, &entries)
}

// ────────────────────────────────────────────────────────────────────────────
// License (unchanged from ICD reference)
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn license_status(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::status(&state.data_dir)
}

#[tauri::command]
fn license_activate(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<license::LicenseState, String> {
    license::activate(&state.data_dir, &key)
}

#[tauri::command]
fn license_validate(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::validate(&state.data_dir)
}

#[tauri::command]
fn license_deactivate(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::deactivate(&state.data_dir)
}

#[tauri::command]
fn license_toggle_override(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::toggle_override(&state.data_dir)
}

// ────────────────────────────────────────────────────────────────────────────
// Entry
// ────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = app
                .path()
                .resolve("resources/irssnap.sqlite", tauri::path::BaseDirectory::Resource)
                .expect("bundled IRS database resource is missing");
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data directory");
            app.manage(AppState { db_path, data_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_irs,
            fetch_provision,
            fetch_form,
            fetch_publication,
            store_read,
            store_write,
            write_text_file,
            export_pdf,
            license_status,
            license_activate,
            license_validate,
            license_deactivate,
            license_toggle_override
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
