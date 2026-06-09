//! Native menu bar (Phase D). The menu defines structure + shortcuts; every
//! click emits a `menu:<id>` event the React layer listens for and dispatches
//! to the same handlers our keyboard shortcuts already use. macOS gets the
//! global menubar, Windows the window menu.
//!
//! ID naming: `<scope>.<action>` — keep this contract because the React-side
//! `App.tsx` listener depends on it.

use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_opener::OpenerExt;

const HELP_USC_URL: &str = "https://uscode.house.gov/browse/prelim@title26&edition=prelim";
const HELP_CFR_URL: &str = "https://www.ecfr.gov/current/title-26";
const HELP_IRS_URL: &str = "https://www.irs.gov/forms-instructions";
const HELP_PRIVACY_URL: &str = "https://github.com/RangeAreaScent/IRS-Snap-Desktop#privacy";

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let app_metadata = AboutMetadata {
        name: Some("IRS Snap".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("© 2026 Ryan D — public-domain dataset (uscode.house.gov, ecfr.gov, irs.gov)".into()),
        ..Default::default()
    };

    let app_submenu = SubmenuBuilder::new(app, "IRS Snap")
        .item(&PredefinedMenuItem::about(app, Some("About IRS Snap"), Some(app_metadata))?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("app.preferences", "Preferences…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("file.new_search", "New Search")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file.command_palette", "Command Palette…")
                .accelerator("CmdOrCtrl+K")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file.export_collection", "Export Collection…")
                .accelerator("CmdOrCtrl+E")
                .build(app)?,
        )
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("edit.copy_citation", "Copy Citation")
                .accelerator("CmdOrCtrl+Shift+C")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("edit.find", "Find…")
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("view.tab_search", "Search")
                .accelerator("CmdOrCtrl+1")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.tab_favorites", "Favorites")
                .accelerator("CmdOrCtrl+2")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.tab_collections", "Collections")
                .accelerator("CmdOrCtrl+3")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.tab_settings", "Settings")
                .accelerator("CmdOrCtrl+4")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("view.reset_splitter", "Reset Splitter Width").build(app)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("help.how_to_use", "How to Use IRS Snap").build(app)?)
        .item(&MenuItemBuilder::with_id("help.database", "Database Details").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("help.usc26", "Browse 26 U.S.C. (uscode.house.gov)").build(app)?)
        .item(&MenuItemBuilder::with_id("help.cfr26", "Browse 26 CFR (ecfr.gov)").build(app)?)
        .item(&MenuItemBuilder::with_id("help.irs_forms", "IRS Forms & Instructions").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("help.privacy", "Privacy Policy").build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, id: &str) {
    // External URLs go through the opener plugin directly — no React round-trip.
    match id {
        "help.usc26" => {
            let _ = app.opener().open_url(HELP_USC_URL, None::<&str>);
            return;
        }
        "help.cfr26" => {
            let _ = app.opener().open_url(HELP_CFR_URL, None::<&str>);
            return;
        }
        "help.irs_forms" => {
            let _ = app.opener().open_url(HELP_IRS_URL, None::<&str>);
            return;
        }
        "help.privacy" => {
            let _ = app.opener().open_url(HELP_PRIVACY_URL, None::<&str>);
            return;
        }
        _ => {}
    }

    // Everything else hands off to React via a `menu:<id>` event.
    let _ = app.emit(&format!("menu:{id}"), ());
}
