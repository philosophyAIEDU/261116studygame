// PC 설치형 앱의 진입점. 화면은 웹 코드(../dist)를 그대로 쓰고,
// 여기서는 자동 업데이트(updater)와 재시작(process) 플러그인만 연결한다.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 업데이트 확인·내려받기·설치는 웹 쪽(src/app/registerUpdate.ts)에서 시작한다.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            #[cfg(not(desktop))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
