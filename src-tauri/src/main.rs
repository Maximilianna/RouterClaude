// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const BACKEND_PORT: u16 = 8900;

struct BackendProcess(Mutex<Option<Child>>);

/// Resolve the path to the backend JAR.
fn jar_path(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        // Dev: relative to cargo manifest (src-tauri/), built by `mvn package`
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("backend")
            .join("target")
            .join("routerclaude-backend-1.0.0.jar")
    } else {
        // Prod: try resource_dir, then exe parent dir
        let jar_name = "routerclaude-backend-1.0.0.jar";

        if let Ok(dir) = app.path().resource_dir() {
            let p = dir.join(jar_name);
            if p.exists() {
                return p;
            }
        }

        // Fallback: alongside the executable
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let paths = [
                    parent.join(jar_name),
                    parent.join("_up_").join("backend").join("target").join(jar_name),
                ];
                for p in &paths {
                    if p.exists() {
                        return p.clone();
                    }
                }
            }
        }

        // Last resort
        eprintln!("Backend JAR not found");
        PathBuf::from(jar_name)
    }
}

/// Resolve the JRE binary path (bundled jlink JRE or system Java).
fn java_bin() -> PathBuf {
    // Check for bundled jlink JRE first (prod builds)
    let bundled_jre = bundled_jre_path();
    if bundled_jre.exists() {
        return bundled_jre;
    }
    // Fall back to system Java
    PathBuf::from("java")
}

#[cfg(target_os = "windows")]
fn bundled_jre_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new("."));
    dir.join("jre").join("bin").join("java.exe")
}

#[cfg(not(target_os = "windows"))]
fn bundled_jre_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new("."));
    dir.join("jre").join("bin").join("java")
}

/// Wait for a TCP port to be ready, polling every 200ms.
fn wait_for_port(port: u16, timeout_secs: u64) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed().as_secs() < timeout_secs {
        if TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

fn start_backend(app: &tauri::AppHandle) -> Option<Child> {
    let jar = jar_path(app);
    let java = java_bin();

    if !jar.exists() {
        eprintln!(
            "Backend JAR not found at {}. Run `pnpm backend:build` first.",
            jar.display()
        );
        return None;
    }

    let mut cmd = Command::new(java);
    cmd.arg("-jar")
        .arg(&jar)
        .arg(format!("--server.port={}", BACKEND_PORT))
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let child = cmd.spawn()
        .inspect_err(|e| eprintln!("Failed to start backend: {}", e))
        .ok()?;

    eprintln!(
        "Backend started (PID: {}), waiting for port {}...",
        child.id(),
        BACKEND_PORT
    );

    if wait_for_port(BACKEND_PORT, 15) {
        eprintln!("Backend ready on port {}", BACKEND_PORT);
    } else {
        eprintln!("Warning: backend did not become ready within 15s");
    }

    Some(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 设置窗口图标（编译时嵌入到二进制）
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/32x32.png");
                match tauri::image::Image::from_bytes(icon_bytes) {
                    Ok(img) => { let _ = window.set_icon(img); }
                    Err(e) => { eprintln!("Failed to load icon: {}", e); }
                }
            }

            let backend = start_backend(app.handle());
            app.manage(BackendProcess(Mutex::new(backend)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            eprintln!("Shutting down backend...");
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running RouterClaude");
}
