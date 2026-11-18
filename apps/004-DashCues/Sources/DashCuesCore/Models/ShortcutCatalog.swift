import Foundation


enum ShortcutCatalog {
    static let builtIns: [ShortcutApplication] = [
        ShortcutApplication(
            id: "com.apple.finder",
            name: "Finder",
            bundleIdentifier: "com.apple.finder",
            symbolName: "folder",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "finder-new-window", title: "開啟新 Finder 視窗", keys: ["⌘", "N"], tags: ["視窗"]),
                ShortcutItem(id: "finder-new-folder", title: "建立新資料夾", keys: ["⇧", "⌘", "N"], tags: ["檔案"]),
                ShortcutItem(id: "finder-get-info", title: "顯示資訊", keys: ["⌘", "I"], tags: ["檔案"]),
                ShortcutItem(id: "finder-quick-look", title: "快速查看", keys: ["Space"], tags: ["檔案"]),
                ShortcutItem(id: "finder-go-applications", title: "前往「應用程式」", keys: ["⇧", "⌘", "A"], tags: ["導覽"]),
                ShortcutItem(id: "finder-go-downloads", title: "前往「下載項目」", keys: ["⌥", "⌘", "L"], tags: ["導覽"]),
                ShortcutItem(id: "finder-go-folder", title: "前往資料夾", keys: ["⇧", "⌘", "G"], tags: ["導覽"]),
                ShortcutItem(id: "finder-trash", title: "移至垃圾桶", keys: ["⌘", "⌫"], tags: ["檔案"]),
                ShortcutItem(id: "finder-empty-trash", title: "清倒垃圾桶", keys: ["⇧", "⌘", "⌫"], tags: ["檔案"]),
                ShortcutItem(id: "finder-close-window", title: "關閉視窗", keys: ["⌘", "W"], tags: ["視窗"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.Safari",
            name: "Safari",
            bundleIdentifier: "com.apple.Safari",
            symbolName: "safari",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "safari-new-tab", title: "開啟新分頁", keys: ["⌘", "T"], tags: ["分頁"]),
                ShortcutItem(id: "safari-new-window", title: "開啟新視窗", keys: ["⌘", "N"], tags: ["視窗"]),
                ShortcutItem(id: "safari-private-window", title: "開啟私密瀏覽視窗", keys: ["⇧", "⌘", "N"], tags: ["視窗"]),
                ShortcutItem(id: "safari-focus-address", title: "選取智慧型搜尋欄位", keys: ["⌘", "L"], tags: ["導覽"]),
                ShortcutItem(id: "safari-close-tab", title: "關閉分頁", keys: ["⌘", "W"], tags: ["分頁"]),
                ShortcutItem(id: "safari-reopen-tab", title: "重新開啟上次關閉的分頁", keys: ["⇧", "⌘", "T"], tags: ["分頁"]),
                ShortcutItem(id: "safari-reload", title: "重新載入頁面", keys: ["⌘", "R"], tags: ["導覽"]),
                ShortcutItem(id: "safari-find", title: "在頁面中尋找", keys: ["⌘", "F"], tags: ["編輯"]),
                ShortcutItem(id: "safari-downloads", title: "顯示下載項目", keys: ["⌥", "⌘", "L"], tags: ["導覽"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.mail",
            name: "Mail",
            bundleIdentifier: "com.apple.mail",
            symbolName: "envelope",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "mail-new-message", title: "新增郵件", keys: ["⌘", "N"], tags: ["郵件"]),
                ShortcutItem(id: "mail-send", title: "傳送郵件", keys: ["⇧", "⌘", "D"], tags: ["郵件"]),
                ShortcutItem(id: "mail-reply", title: "回覆", keys: ["⌘", "R"], tags: ["郵件"]),
                ShortcutItem(id: "mail-reply-all", title: "全部回覆", keys: ["⇧", "⌘", "R"], tags: ["郵件"]),
                ShortcutItem(id: "mail-forward", title: "轉寄", keys: ["⇧", "⌘", "F"], tags: ["郵件"]),
                ShortcutItem(id: "mail-search", title: "搜尋郵件", keys: ["⌥", "⌘", "F"], tags: ["導覽"]),
                ShortcutItem(id: "mail-archive", title: "封存選取的郵件", keys: ["⌃", "⌘", "A"], tags: ["郵件"]),
                ShortcutItem(id: "mail-check", title: "取得新郵件", keys: ["⇧", "⌘", "N"], tags: ["郵件"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.iCal",
            name: "Calendar",
            bundleIdentifier: "com.apple.iCal",
            symbolName: "calendar",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "calendar-new-event", title: "新增行程", keys: ["⌘", "N"], tags: ["行程"]),
                ShortcutItem(id: "calendar-today", title: "前往今天", keys: ["⌘", "T"], tags: ["導覽"]),
                ShortcutItem(id: "calendar-day", title: "切換至日檢視", keys: ["⌘", "1"], tags: ["檢視"]),
                ShortcutItem(id: "calendar-week", title: "切換至週檢視", keys: ["⌘", "2"], tags: ["檢視"]),
                ShortcutItem(id: "calendar-month", title: "切換至月檢視", keys: ["⌘", "3"], tags: ["檢視"]),
                ShortcutItem(id: "calendar-year", title: "切換至年檢視", keys: ["⌘", "4"], tags: ["檢視"]),
                ShortcutItem(id: "calendar-search", title: "搜尋行程", keys: ["⌘", "F"], tags: ["導覽"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.Notes",
            name: "Notes",
            bundleIdentifier: "com.apple.Notes",
            symbolName: "note.text",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "notes-new-note", title: "新增備忘錄", keys: ["⌘", "N"], tags: ["備忘錄"]),
                ShortcutItem(id: "notes-new-folder", title: "新增資料夾", keys: ["⇧", "⌘", "N"], tags: ["資料夾"]),
                ShortcutItem(id: "notes-new-checklist", title: "新增檢查表", keys: ["⇧", "⌘", "L"], tags: ["格式"]),
                ShortcutItem(id: "notes-find", title: "尋找", keys: ["⌘", "F"], tags: ["編輯"]),
                ShortcutItem(id: "notes-bold", title: "套用粗體", keys: ["⌘", "B"], tags: ["格式"]),
                ShortcutItem(id: "notes-italic", title: "套用斜體", keys: ["⌘", "I"], tags: ["格式"]),
                ShortcutItem(id: "notes-check", title: "勾選或取消勾選項目", keys: ["⇧", "⌘", "U"], tags: ["格式"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.Preview",
            name: "Preview",
            bundleIdentifier: "com.apple.Preview",
            symbolName: "doc.viewfinder",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "preview-open", title: "打開檔案", keys: ["⌘", "O"], tags: ["檔案"]),
                ShortcutItem(id: "preview-save", title: "儲存", keys: ["⌘", "S"], tags: ["檔案"]),
                ShortcutItem(id: "preview-zoom-in", title: "放大", keys: ["⌘", "+"], tags: ["檢視"]),
                ShortcutItem(id: "preview-zoom-out", title: "縮小", keys: ["⌘", "−"], tags: ["檢視"]),
                ShortcutItem(id: "preview-rotate-left", title: "向左旋轉", keys: ["⌘", "L"], tags: ["工具"]),
                ShortcutItem(id: "preview-rotate-right", title: "向右旋轉", keys: ["⌘", "R"], tags: ["工具"]),
                ShortcutItem(id: "preview-show-inspector", title: "顯示檢閱器", keys: ["⌘", "I"], tags: ["檢視"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.TextEdit",
            name: "TextEdit",
            bundleIdentifier: "com.apple.TextEdit",
            symbolName: "doc.text",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "textedit-new", title: "新增文件", keys: ["⌘", "N"], tags: ["檔案"]),
                ShortcutItem(id: "textedit-open", title: "打開文件", keys: ["⌘", "O"], tags: ["檔案"]),
                ShortcutItem(id: "textedit-save", title: "儲存", keys: ["⌘", "S"], tags: ["檔案"]),
                ShortcutItem(id: "textedit-find", title: "尋找", keys: ["⌘", "F"], tags: ["編輯"]),
                ShortcutItem(id: "textedit-bold", title: "套用粗體", keys: ["⌘", "B"], tags: ["格式"]),
                ShortcutItem(id: "textedit-italic", title: "套用斜體", keys: ["⌘", "I"], tags: ["格式"]),
                ShortcutItem(id: "textedit-underline", title: "套用底線", keys: ["⌘", "U"], tags: ["格式"])
            ]
        ),
        ShortcutApplication(
            id: "com.apple.Terminal",
            name: "Terminal",
            bundleIdentifier: "com.apple.Terminal",
            symbolName: "terminal",
            isBuiltIn: true,
            shortcuts: [
                ShortcutItem(id: "terminal-new-window", title: "新增視窗", keys: ["⌘", "N"], tags: ["視窗"]),
                ShortcutItem(id: "terminal-new-tab", title: "新增分頁", keys: ["⌘", "T"], tags: ["分頁"]),
                ShortcutItem(id: "terminal-close-tab", title: "關閉分頁", keys: ["⇧", "⌘", "W"], tags: ["分頁"]),
                ShortcutItem(id: "terminal-clear", title: "清除畫面", keys: ["⌘", "K"], tags: ["檢視"]),
                ShortcutItem(id: "terminal-find", title: "尋找", keys: ["⌘", "F"], tags: ["編輯"]),
                ShortcutItem(id: "terminal-font-plus", title: "放大文字", keys: ["⌘", "+"], tags: ["檢視"]),
                ShortcutItem(id: "terminal-font-minus", title: "縮小文字", keys: ["⌘", "−"], tags: ["檢視"])
            ]
        )
    ]
}
