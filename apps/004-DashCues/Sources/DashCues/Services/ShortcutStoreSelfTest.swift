import Foundation

enum ShortcutStoreSelfTest {
    @MainActor
    static func run() throws {
        let directory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
            .appendingPathComponent(".self-test-data-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer {
            do {
                try FileManager.default.removeItem(at: directory)
            } catch {
                fputs("Could not clean up self-test data: \(error.localizedDescription)\n", stderr)
            }
        }

        let storageURL = directory.appendingPathComponent("shortcuts.json")
        let backupURL = directory.appendingPathComponent("backup.json")
        let store = try ShortcutStore(storageURL: storageURL)
        try check(store.applications.count == ShortcutCatalog.builtIns.count, "Built-in data did not load.")

        let appID = try store.addApplication(
            name: "Self Test App",
            bundleIdentifier: "com.example.self-test",
            symbolName: "app"
        )
        try store.saveShortcut(
            ShortcutItem(title: "Run", keys: ["⌘", "R"], tags: ["Workflow"]),
            applicationID: appID
        )
        try store.setPinned(true, applicationID: appID)

        let reopenedStore = try ShortcutStore(storageURL: storageURL)
        guard let reopenedApp = reopenedStore.application(id: appID) else {
            throw ShortcutStoreSelfTestError.failed("Local data did not persist.")
        }
        try check(reopenedApp.isPinned, "Pinned app state did not persist.")
        try check(reopenedApp.shortcuts.map(\.title) == ["Run"], "Shortcut data did not persist.")
        try check(reopenedStore.pinnedApplications.first?.id == appID, "Pinned app ordering is incorrect.")

        try check(reopenedStore.applications.first?.id == appID, "Pinned app is not at the top of the list.")

        // Reordering: pinned apps always stay above unpinned apps.
        let finderID = "com.apple.finder"
        try reopenedStore.moveApplications(fromOffsets: IndexSet(integer: reopenedStore.applications.count - 1), toOffset: 0)
        try check(reopenedStore.applications.first?.isPinned == true, "Unpinned app moved above a pinned app.")
        try reopenedStore.setPinned(true, applicationID: finderID)
        try check(
            reopenedStore.applications.map(\.id).prefix(2) == [finderID, appID],
            "Newly pinned app should be placed first."
        )
        try reopenedStore.moveApplications(fromOffsets: IndexSet(integer: 0), toOffset: 2)
        try check(
            reopenedStore.applications.map(\.id).prefix(2) == [appID, finderID],
            "Pinned apps could not be reordered."
        )
        let orderBeforeReload = reopenedStore.applications.map(\.id)
        try check(
            try ShortcutStore(storageURL: storageURL).applications.map(\.id) == orderBeforeReload,
            "App order did not persist."
        )
        let firstPinnedCount = reopenedStore.pinnedApplications.count
        try check(
            reopenedStore.applications.prefix(firstPinnedCount).allSatisfy(\.isPinned),
            "Pinned apps are not contiguous at the top."
        )
        try reopenedStore.setPinned(false, applicationID: finderID)
        try check(
            reopenedStore.applications.map(\.id).prefix(2) == [appID, finderID],
            "Unpinned app should return to the top of the unpinned section."
        )

        try expectError(ShortcutStoreError.invalidShortcut) {
            try reopenedStore.saveShortcut(
                ShortcutItem(title: " ", keys: []),
                applicationID: "com.apple.finder"
            )
        }
        try expectError(ShortcutStoreError.duplicateApplication) {
            _ = try reopenedStore.addApplication(name: "Finder", bundleIdentifier: "", symbolName: "folder")
        }
        try check(
            HotKeyLabel.string(for: .defaultValue) == "⌃⌥⌘K",
            "The default global hotkey label is incorrect."
        )

        try runPopoverNavigationChecks(store: reopenedStore)
        try runShortcutListChecks(store: reopenedStore, applicationID: appID)
        try runKeyValueChecks(store: reopenedStore, applicationID: appID, directory: directory)
        try KeyValueEditSessionSelfTest.run(store: reopenedStore)

        try reopenedStore.exportBackup(to: backupURL)
        try reopenedStore.deleteApplication(id: appID)
        try check(reopenedStore.application(id: appID) == nil, "App deletion did not work.")
        try reopenedStore.restoreBackup(from: backupURL)
        try check(
            reopenedStore.application(id: appID)?.keyValueCheatsheets.first?.entries.count == 2,
            "Backup restore did not restore Key-Value data."
        )

        try runLegacySnapshotCheck(in: directory)
        try runSheetMigrationChecks(in: directory)
        try runSheetManagementChecks(in: directory)

        print("DashCues self-test passed.")
    }

    @MainActor
    private static func runKeyValueChecks(
        store: ShortcutStore,
        applicationID: String,
        directory: URL
    ) throws {
        let commandsID = try store.createKeyValueCheatsheet(name: "Commands", applicationID: applicationID)
        let promptsID = try store.createKeyValueCheatsheet(name: "Prompts", applicationID: applicationID)
        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            _ = try store.createKeyValueCheatsheet(name: " commands ", applicationID: applicationID)
        }
        try expectError(ShortcutStoreError.invalidCheatsheetName) {
            _ = try store.createKeyValueCheatsheet(name: "  ", applicationID: applicationID)
        }

        let anotherAppID = try store.addApplication(
            name: "Another Self Test App",
            bundleIdentifier: "com.example.self-test-other",
            symbolName: "app"
        )
        _ = try store.createKeyValueCheatsheet(name: "Commands", applicationID: anotherAppID)

        try store.saveKeyValueEntry(
            KeyValueEntry(key: "  Hello  ", value: "First line\nSecond line"),
            cheatsheetID: commandsID,
            applicationID: applicationID
        )
        try store.saveKeyValueEntry(
            KeyValueEntry(key: "Desired output", value: "Write in a concise tone"),
            cheatsheetID: promptsID,
            applicationID: applicationID
        )
        let searchResults = store.searchKeyValueEntries("CONCISE", applicationID: applicationID)
        try check(
            searchResults.count == 1
                && searchResults.first?.cheatsheetID == promptsID
                && searchResults.first?.cheatsheetName == "Prompts"
                && searchResults.first?.entry.value == "Write in a concise tone",
            "Key-Value search did not find a value across cheatsheets with its context."
        )
        try check(
            store.searchKeyValueEntries("desired", applicationID: applicationID).first?.entry.key == "Desired output",
            "Key-Value search did not match the Key field."
        )
        try check(
            store.searchKeyValueEntries("concise", applicationID: anotherAppID).isEmpty,
            "Key-Value search returned content from another app."
        )
        try check(
            store.hasDuplicateKey(
                "hello",
                cheatsheetID: commandsID,
                applicationID: applicationID
            ),
            "Duplicate Key detection did not trim whitespace and ignore case."
        )
        try check(
            !store.hasDuplicateKey(
                "hello",
                cheatsheetID: promptsID,
                applicationID: applicationID
            ),
            "Duplicate Keys should be scoped to one cheatsheet."
        )
        try store.saveKeyValueEntry(
            KeyValueEntry(key: "hello", value: ""),
            cheatsheetID: commandsID,
            applicationID: applicationID
        )
        try expectError(ShortcutStoreError.invalidKeyValueEntry) {
            try store.saveKeyValueEntry(
                KeyValueEntry(key: " \n ", value: " "),
                cheatsheetID: commandsID,
                applicationID: applicationID
            )
        }

        let firstEntryID = store.application(id: applicationID)?
            .keyValueCheatsheets.first(where: { $0.id == commandsID })?.entries.first?.id
        try check(firstEntryID != nil, "Key-Value entry was not saved.")
        try store.saveKeyValueEntry(
            KeyValueEntry(id: firstEntryID!, key: "Renamed", value: "Updated\nvalue"),
            cheatsheetID: commandsID,
            applicationID: applicationID
        )
        try check(
            store.application(id: applicationID)?
                .keyValueCheatsheets.first(where: { $0.id == commandsID })?.entries.first?.value == "Updated\nvalue",
            "Key-Value entry edits did not preserve multiline text."
        )

        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            try store.renameKeyValueCheatsheet(
                id: promptsID,
                name: " commands ",
                applicationID: applicationID
            )
        }
        try store.renameKeyValueCheatsheet(id: promptsID, name: "Ideas", applicationID: applicationID)
        try store.deleteKeyValueCheatsheet(id: promptsID, applicationID: applicationID)
        try check(
            store.application(id: applicationID)?.keyValueCheatsheets.map(\.name) == ["Commands"],
            "Cheatsheet rename or delete failed."
        )
        try store.deleteApplication(id: anotherAppID)

        let reopened = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        try check(
            reopened.application(id: applicationID)?.keyValueCheatsheets.first?.entries.count == 2,
            "Key-Value data did not persist after reload."
        )
    }

    @MainActor
    private static func runLegacySnapshotCheck(in directory: URL) throws {
        let legacyURL = directory.appendingPathComponent("legacy.json")
        let legacyData = Data(
            """
            {
              "schemaVersion": 1,
              "applications": [{
                "id": "legacy-app",
                "name": "Legacy App",
                "bundleIdentifier": "com.example.legacy",
                "symbolName": "app",
                "isBuiltIn": false,
                "isPinned": false,
                "shortcuts": [{
                  "id": "legacy-shortcut",
                  "title": "Open",
                  "keys": ["⌘", "O"],
                  "tags": [],
                  "notes": ""
                }],
                "tags": []
              }],
              "hotKey": {"keyCode": 40, "modifiers": 6400}
            }
            """.utf8
        )
        try legacyData.write(to: legacyURL)
        let store = try ShortcutStore(storageURL: legacyURL)
        try check(
            store.application(id: "legacy-app")?.shortcuts.map(\.title) == ["Open"],
            "Schema-version-1 shortcut data did not load."
        )
        try check(
            store.application(id: "legacy-app")?.keyValueCheatsheets.isEmpty == true,
            "Legacy app did not initialize with an empty Key-Value collection."
        )
    }

    @MainActor
    private static func runSheetMigrationChecks(in directory: URL) throws {
        func legacyJSON(keyValueSheetNames: [String]) -> Data {
            let sheets = keyValueSheetNames.enumerated().map { index, name in
                """
                {"id": "kv-\(index)", "name": "\(name)",
                 "entries": [{"id": "e-\(index)", "key": "K\(index)", "value": "V\(index)"}]}
                """
            }.joined(separator: ",")
            return Data(
                """
                {
                  "schemaVersion": 1,
                  "applications": [{
                    "id": "old-app", "name": "Old App", "bundleIdentifier": "", "symbolName": "app",
                    "isBuiltIn": false, "isPinned": false, "tags": ["Nav"],
                    "shortcuts": [{"id": "s1", "title": "Open", "keys": ["⌘", "O"], "tags": ["Nav"], "notes": "n"}],
                    "keyValueCheatsheets": [\(sheets)]
                  }],
                  "hotKey": {"keyCode": 40, "modifiers": 6400}
                }
                """.utf8
            )
        }

        let url = directory.appendingPathComponent("migrate.json")
        try legacyJSON(keyValueSheetNames: ["Commands", "Prompts"]).write(to: url)
        let store = try ShortcutStore(storageURL: url)
        guard let app = store.application(id: "old-app") else {
            throw ShortcutStoreSelfTestError.failed("Migrated app is missing.")
        }
        try check(
            app.sheets.map(\.name) == ["快捷鍵", "Commands", "Prompts"]
                && app.sheets.map(\.kind) == [.shortcuts, .keyValue, .keyValue],
            "Migration did not put the shortcut sheet first and keep Key-Value sheet order."
        )
        try check(
            app.sheets.dropFirst().map(\.id) == ["kv-0", "kv-1"]
                && app.keyValueCheatsheets.first?.entries.first?.value == "V0",
            "Migration changed Key-Value sheet identities or contents."
        )
        try check(
            app.shortcuts.map(\.id) == ["s1"] && app.tags == ["Nav"],
            "Migration lost shortcuts or app tags."
        )

        let reopened = try ShortcutStore(storageURL: url)
        try check(
            reopened.application(id: "old-app")?.sheets == app.sheets,
            "Migrated sheets did not persist or reopen identically."
        )

        try legacyJSON(keyValueSheetNames: ["快捷鍵", "快捷鍵 2"]).write(to: url)
        let collided = try ShortcutStore(storageURL: url).application(id: "old-app")
        try check(
            collided?.sheets.map(\.name) == ["快捷鍵 3", "快捷鍵", "快捷鍵 2"],
            "Shortcut sheet name collisions were not resolved by incrementing."
        )

        let oldBackup = directory.appendingPathComponent("old-backup.json")
        try legacyJSON(keyValueSheetNames: ["Commands"]).write(to: oldBackup)
        let target = try ShortcutStore(storageURL: directory.appendingPathComponent("restore-target.json"))
        try target.restoreBackup(from: oldBackup)
        try check(
            target.application(id: "old-app")?.sheets.map(\.name) == ["快捷鍵", "Commands"],
            "Older backup did not restore into sheets."
        )

        let newBackup = directory.appendingPathComponent("new-backup.json")
        try target.exportBackup(to: newBackup)
        let roundTrip = try ShortcutStore(storageURL: directory.appendingPathComponent("round-trip.json"))
        try roundTrip.restoreBackup(from: newBackup)
        try check(
            roundTrip.application(id: "old-app")?.sheets == target.application(id: "old-app")?.sheets,
            "New backup did not round trip sheets."
        )

        let freshID = try roundTrip.addApplication(name: "Fresh", bundleIdentifier: "", symbolName: "app")
        let fresh = roundTrip.application(id: freshID)
        try check(
            fresh?.sheets.map(\.name) == ["快捷鍵"] && fresh?.sheets.first?.kind == .shortcuts
                && fresh?.shortcuts.isEmpty == true,
            "New apps should start with one empty 快捷鍵 sheet."
        )
        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            _ = try roundTrip.createKeyValueCheatsheet(name: "快捷鍵", applicationID: freshID)
        }
    }

    @MainActor
    private static func runSheetManagementChecks(in directory: URL) throws {
        let url = directory.appendingPathComponent("sheet-management.json")
        let store = try ShortcutStore(storageURL: url)
        let appID = try store.addApplication(name: "Sheets", bundleIdentifier: "", symbolName: "app")
        let otherID = try store.addApplication(name: "Other", bundleIdentifier: "", symbolName: "app")
        let baseID = try unwrap(store.application(id: appID)?.sheets.first?.id)

        // Create: appended, typed, trimmed; names unique across both types per app.
        let extraID = try store.createSheet(kind: .shortcuts, name: "  Extra ", applicationID: appID)
        let kvID = try store.createSheet(kind: .keyValue, name: "Notes", applicationID: appID)
        try check(
            store.application(id: appID)?.sheets.map(\.id) == [baseID, extraID, kvID]
                && store.application(id: appID)?.sheets.map(\.name) == ["快捷鍵", "Extra", "Notes"]
                && store.application(id: appID)?.sheets[1].kind == .shortcuts
                && store.application(id: appID)?.sheets[2].kind == .keyValue,
            "Created sheets were not appended with their type."
        )
        try expectError(ShortcutStoreError.invalidCheatsheetName) {
            _ = try store.createSheet(kind: .keyValue, name: "  ", applicationID: appID)
        }
        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            _ = try store.createSheet(kind: .shortcuts, name: " NOTES", applicationID: appID)
        }
        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            _ = try store.createSheet(kind: .keyValue, name: "extra", applicationID: appID)
        }
        _ = try store.createSheet(kind: .keyValue, name: "Notes", applicationID: otherID)

        // Shortcuts are saved to the chosen shortcut sheet.
        try store.saveShortcut(ShortcutItem(title: "Extra item", keys: ["⌘", "E"]), applicationID: appID, sheetID: extraID)
        try check(
            store.application(id: appID)?.shortcuts.isEmpty == true
                && store.application(id: appID)?.sheetShortcuts(id: extraID).map(\.title) == ["Extra item"],
            "Shortcut was not saved to the requested sheet."
        )
        try store.saveKeyValueEntry(KeyValueEntry(key: "k", value: "v"), cheatsheetID: kvID, applicationID: appID)

        // Atomic edit: rename + reorder + delete commit together with the app details.
        try store.updateApplicationDetails(
            id: appID, name: "Sheets", bundleIdentifier: "", symbolName: "app",
            sheetEdits: [SheetEdit(id: kvID, name: "Renamed"), SheetEdit(id: baseID, name: "快捷鍵")]
        )
        try check(
            store.application(id: appID)?.sheets.map(\.id) == [kvID, baseID]
                && store.application(id: appID)?.sheets.map(\.name) == ["Renamed", "快捷鍵"]
                && store.application(id: appID)?.keyValueCheatsheets.first?.entries.count == 1,
            "Sheet edits were not applied together."
        )

        // Invalid edits change nothing, including other app details.
        let before = store.application(id: appID)
        try expectError(ShortcutStoreError.duplicateCheatsheetName) {
            try store.updateApplicationDetails(
                id: appID, name: "Changed", bundleIdentifier: "", symbolName: "app",
                sheetEdits: [SheetEdit(id: kvID, name: "A"), SheetEdit(id: baseID, name: " a ")]
            )
        }
        try expectError(ShortcutStoreError.invalidCheatsheetName) {
            try store.updateApplicationDetails(
                id: appID, name: "Changed", bundleIdentifier: "", symbolName: "app",
                sheetEdits: [SheetEdit(id: kvID, name: " "), SheetEdit(id: baseID, name: "快捷鍵")]
            )
        }
        try expectError(ShortcutStoreError.cheatsheetNotFound) {
            try store.updateApplicationDetails(
                id: appID, name: "Changed", bundleIdentifier: "", symbolName: "app",
                sheetEdits: [SheetEdit(id: "missing", name: "X")]
            )
        }
        try check(store.application(id: appID) == before, "Invalid sheet edits partially applied.")

        // Delete everything, including the last sheet; persists across relaunch.
        try store.updateApplicationDetails(
            id: appID, name: "Sheets", bundleIdentifier: "", symbolName: "app", sheetEdits: []
        )
        try check(store.application(id: appID)?.sheets.isEmpty == true, "The last sheet could not be deleted.")
        let reopened = try ShortcutStore(storageURL: url)
        try check(reopened.application(id: appID)?.sheets.isEmpty == true, "Empty sheet list did not persist.")
        let recreated = try reopened.createSheet(kind: .keyValue, name: "Again", applicationID: appID)
        try check(reopened.application(id: appID)?.sheets.map(\.id) == [recreated], "Empty app could not create a sheet.")

        // Selection after deletion: next, else previous, else none.
        try check(SheetSelection.afterDeleting(selected: "b", from: ["a", "b", "c"], remaining: ["a", "c"]) == "c", "Next sheet not selected.")
        try check(SheetSelection.afterDeleting(selected: "c", from: ["a", "b", "c"], remaining: ["a", "b"]) == "b", "Previous sheet not selected.")
        try check(SheetSelection.afterDeleting(selected: "a", from: ["a", "b", "c"], remaining: ["c"]) == "c", "Nearest remaining sheet not selected.")
        try check(SheetSelection.afterDeleting(selected: "a", from: ["a"], remaining: []) == nil, "Selection should clear with no sheets.")
        try check(SheetSelection.afterDeleting(selected: "b", from: ["a", "b"], remaining: ["b", "a"]) == "b", "Surviving selection changed.")
        try check(SheetSelection.afterDeleting(selected: nil, from: ["a", "b"], remaining: ["b"]) == nil, "Unselected state changed.")

        // Dashboard sheet selection follows the stored sheet, falling back to the first sheet.
        let suiteName = "DashCues.SelfTest.Sheets.\(UUID().uuidString)"
        guard let suite = UserDefaults(suiteName: suiteName) else { throw ShortcutStoreSelfTestError.failed("No defaults.") }
        defer { suite.removePersistentDomain(forName: suiteName) }
        let navigation = SharedContentNavigation(defaults: suite)
        let sheets: [AppSheet] = [.shortcuts(ShortcutSheet(id: "s1", name: "S")), .keyValue(KeyValueCheatsheet(id: "k1", name: "K"))]
        try check(navigation.selectedSheet(for: "app", in: sheets)?.id == "s1", "Default selection should be the first sheet.")
        navigation.selectSheet(sheets[1], for: "app")
        try check(
            navigation.selectedSheet(for: "app", in: sheets)?.id == "k1" && navigation.selectedContentType == .keyValue,
            "Selecting a sheet did not select it."
        )
        try check(navigation.selectedSheet(for: "app", in: [sheets[0]])?.id == "s1", "Missing selection should fall back.")
        try check(navigation.selectedSheet(for: "app", in: []) == nil, "No sheets should mean no selection.")

        // Built-in apps are fully editable and deletable; deletion survives relaunch.
        let finderID = "com.apple.finder"
        try store.updateApplicationDetails(id: finderID, name: "Finder Renamed", bundleIdentifier: "com.apple.finder", symbolName: "folder")
        let finderSheetID = try unwrap(store.application(id: finderID)?.sheets.first?.id)
        try store.updateApplicationDetails(
            id: finderID, name: "Finder Renamed", bundleIdentifier: "com.apple.finder", symbolName: "folder",
            sheetEdits: [SheetEdit(id: finderSheetID, name: "Main")]
        )
        _ = try store.createSheet(kind: .keyValue, name: "Cheats", applicationID: finderID)
        try check(
            store.application(id: finderID)?.sheets.map(\.name) == ["Main", "Cheats"],
            "Built-in app sheets could not be managed."
        )
        try store.deleteApplication(id: finderID)
        try check(try ShortcutStore(storageURL: url).application(id: finderID) == nil, "Built-in deletion did not persist.")
    }

    private static func unwrap<T>(_ value: T?, _ message: String = "Unexpected nil") throws -> T {
        guard let value else { throw ShortcutStoreSelfTestError.failed(message) }
        return value
    }

    @MainActor
    private static func runPopoverNavigationChecks(store: ShortcutStore) throws {
        var opened = 0
        var closed = 0
        let suiteName = "DashCues.SelfTest.\(UUID().uuidString)"
        guard let contentNavigationDefaults = UserDefaults(suiteName: suiteName) else {
            throw ShortcutStoreSelfTestError.failed("Could not create isolated preferences.")
        }
        defer { contentNavigationDefaults.removePersistentDomain(forName: suiteName) }
        let contentNavigation = SharedContentNavigation(defaults: contentNavigationDefaults)
        let nav = PopoverNavigation(
            store: store,
            contentNavigation: contentNavigation,
            onOpenDashboard: { opened += 1 },
            onClose: { closed += 1 }
        )
        let ids = (store.pinnedApplications + store.otherApplications).map(\.id)
        try check(nav.searchFocused && !nav.focusOnOpenButton, "Popover should focus the search field first.")
        nav.keyValueSearchFocused = true
        for key in [UInt16(123), 124, 125, 126, 53] {
            try check(!nav.handle(keyCode: key), "Key-Value search editing key was intercepted.")
        }
        nav.keyValueSearchFocused = false
        _ = nav.handle(keyCode: 126)
        try check(nav.focusOnOpenButton && !nav.searchFocused, "Up from search did not reach the open button.")
        _ = nav.handle(keyCode: 36)
        try check(opened == 1, "Enter did not open the dashboard.")
        _ = nav.handle(keyCode: 126)
        try check(nav.focusOnOpenButton, "Up on the open button should stay put.")
        _ = nav.handle(keyCode: 125)
        try check(nav.searchFocused, "Down from the open button should focus search.")
        _ = nav.handle(keyCode: 125)
        try check(!nav.searchFocused && nav.selectedApplicationID == ids[0], "Down from search did not select the first app.")
        _ = nav.handle(keyCode: 126)
        try check(nav.searchFocused, "Up from the first app should focus search.")
        nav.searchFocused = true
        nav.searchText = String((store.applications.first?.name ?? "a").prefix(3))
        try check(nav.pinnedApplications.count + nav.otherApplications.count >= 1, "Search did not keep a matching app.")
        try check(nav.selectedApplicationID != nil, "Search left no selected app.")
        nav.searchText = "zzzz-no-such-app"
        try check(nav.pinnedApplications.isEmpty && nav.otherApplications.isEmpty, "Search did not filter apps.")
        _ = nav.handle(keyCode: 53)
        try check(nav.searchText.isEmpty && closed == 0, "Esc in search should clear text before closing.")
        _ = nav.handle(keyCode: 125)
        try check(!nav.focusOnOpenButton && nav.selectedApplicationID == ids[0], "Down did not select the first app.")
        _ = nav.handle(keyCode: 125)
        try check(nav.selectedApplicationID == ids[1], "Down did not move to the next app.")
        try check(!nav.handle(keyCode: 36) && opened == 1, "Enter on an app row should not open the dashboard.")
        _ = nav.handle(keyCode: 126)
        _ = nav.handle(keyCode: 126)
        try check(nav.searchFocused, "Up from the first app did not return to search.")
        _ = nav.handle(keyCode: 125)
        _ = nav.handle(keyCode: 124)
        try check(nav.focusArea == .shortcuts && nav.selectedShortcutID != nil, "Right did not enter the shortcut list.")
        let first = nav.selectedShortcutID
        _ = nav.handle(keyCode: 125)
        let count = store.application(id: nav.selectedApplicationID ?? "")?.shortcuts.count ?? 0
        try check(count < 2 || nav.selectedShortcutID != first, "Down did not move within shortcuts.")
        _ = nav.handle(keyCode: 123)
        try check(nav.focusArea == .applications && nav.selectedShortcutID == nil, "Left did not return to apps.")
        _ = nav.handle(keyCode: 126)
        _ = nav.handle(keyCode: 126)
        _ = nav.handle(keyCode: 53)
        try check(closed == 1, "Esc did not close the popover.")

        contentNavigation.selectContentType(.keyValue)
        contentNavigation.selectCheatsheet("prompts", for: "self-test-app")
        let restoredNavigation = SharedContentNavigation(defaults: contentNavigationDefaults)
        try check(
            restoredNavigation.selectedContentType == .keyValue,
            "Selected content type did not persist."
        )
        try check(
            restoredNavigation.selectedCheatsheetID(for: "self-test-app", availableIDs: ["commands", "prompts"]) == "prompts",
            "Selected Key-Value cheatsheet did not persist per app."
        )
        let result = KeyValueSearchResult(
            cheatsheetID: "commands", cheatsheetName: "Commands",
            entry: KeyValueEntry(id: "entry", key: "Build", value: "Run")
        )
        contentNavigation.requestJump(applicationID: "other-app", result: result)
        let expected = KeyValueJump(applicationID: "other-app", cheatsheetID: "commands", entryID: "entry")
        try check(contentNavigation.pendingJump == expected, "Search jump lost its target.")
        contentNavigation.completeJump(expected)
        try check(contentNavigation.pendingJump == nil, "Search jump was not consumed.")
    }

    @MainActor
    private static func runShortcutListChecks(store: ShortcutStore, applicationID: String) throws {
        func shortcuts() -> [ShortcutItem] { store.application(id: applicationID)?.shortcuts ?? [] }
        let model = ShortcutListModel(store: store, applicationID: applicationID)
        let baseCount = shortcuts().count

        // A new row left blank is discarded.
        model.addNew()
        try check(model.editingField == .title && model.rows.count == baseCount + 1, "New row did not start editing.")
        model.finishEditing()
        try check(shortcuts().count == baseCount && model.selection.isEmpty, "Blank new row was not discarded.")

        // Esc while in input mode on a blank new row also discards it.
        model.addNew()
        _ = model.handleKey(keyCode: 53, flags: [], characters: nil)
        try check(shortcuts().count == baseCount && model.editingField == nil, "Esc did not discard blank new row.")

        // Name only is enough to keep a row.
        model.addNew()
        model.workingItem?.title = "Name Only"
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        try check(shortcuts().last?.title == "Name Only", "Name-only row was not saved.")

        // Tab moves to the key field, which records any key, including a single key without modifiers.
        model.addNew()
        _ = model.handleKey(keyCode: 48, flags: [], characters: nil)
        try check(model.editingField == .keys, "Tab did not move to key combination.")
        _ = model.handleKey(keyCode: 8, flags: [.command, .shift], characters: "c")
        try check(model.workingItem?.keys == ["⇧", "⌘", "C"], "Key combination was not recorded.")
        _ = model.handleKey(keyCode: 96, flags: [], characters: nil)
        try check(model.workingItem?.keys == ["F5"], "Single key without modifiers was not recorded.")
        _ = model.handleKey(keyCode: 48, flags: [], characters: nil)
        _ = model.handleKey(keyCode: 48, flags: [], characters: nil)
        try check(model.editingField == .title, "Tab did not cycle back to the name.")
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        try check(shortcuts().last?.keys == ["F5"] && shortcuts().last?.tags == [], "Keys-only row was not saved.")

        // Enter edits the selected row; Esc restores the field's original value.
        let editID = shortcuts()[shortcuts().count - 2].id
        model.click(editID, field: nil, modifiers: [])
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        try check(model.editingField == .title, "Enter did not start editing.")
        model.workingItem?.title = "Changed"
        _ = model.handleKey(keyCode: 53, flags: [], characters: nil)
        try check(shortcuts().first { $0.id == editID }?.title == "Name Only", "Esc did not keep the original value.")

        // Arrow keys move the selection; shift extends it.
        let ids = shortcuts().map(\.id)
        model.click(ids[ids.count - 2], field: nil, modifiers: [])
        _ = model.handleKey(keyCode: 125, flags: [], characters: nil)
        try check(model.selection == [ids[ids.count - 1]], "Down arrow did not move selection.")
        _ = model.handleKey(keyCode: 126, flags: .shift, characters: nil)
        try check(model.selection == Set(ids.suffix(2)), "Shift+Up did not extend selection.")

        // Deleting removes every selected row.
        model.confirmDelete()
        try check(shortcuts().count == baseCount, "Multi-select delete failed.")

        // Emptying both fields of an existing row removes it.
        let emptied = shortcuts()[0].id
        model.click(emptied, field: nil, modifiers: [])
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        model.workingItem?.title = ""
        model.workingItem?.keys = []
        model.finishEditing()
        try check(shortcuts().first { $0.id == emptied } == nil, "Emptied row was not removed.")

        // Tags: typing suggests existing app tags, Enter adds the highlighted one, new names register on the app.
        func appTags() -> [String] { store.application(id: applicationID)?.tags ?? [] }
        model.addNew()
        model.workingItem?.title = "Tagged"
        _ = model.handleKey(keyCode: 48, flags: [], characters: nil)
        _ = model.handleKey(keyCode: 48, flags: [], characters: nil)
        try check(model.editingField == .tags, "Tab did not reach tags.")
        let existing = appTags().first
        if let existing {
            model.tagDraft = String(existing.prefix(2)).lowercased()
            try check(model.suggestions.contains { $0.name == existing && !$0.isNew }, "Existing tag was not suggested.")
            _ = model.handleKey(keyCode: 125, flags: [], characters: nil)
            _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
            try check(model.workingItem?.tags.contains { $0.lowercased().hasPrefix(String(existing.prefix(2)).lowercased()) } == true,
                      "Highlighted suggestion was not added.")
        }
        model.tagDraft = "Brand New Tag"
        try check(model.suggestions.last?.isNew == true, "New tag option missing.")
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        _ = model.handleKey(keyCode: 36, flags: [], characters: nil)
        try check(shortcuts().last?.tags.contains("Brand New Tag") == true, "New tag was not saved on the shortcut.")
        try check(appTags().contains("Brand New Tag"), "New tag was not registered on the app.")

        // Renaming and deleting tags propagate to shortcuts.
        let current = store.application(id: applicationID)
        let edits = appTags().compactMap { tag -> TagEdit? in
            tag == "Brand New Tag" ? TagEdit(original: tag, name: "Renamed Tag") : TagEdit(original: tag, name: tag)
        }
        try store.updateApplicationDetails(
            id: applicationID,
            name: current?.name ?? "",
            bundleIdentifier: current?.bundleIdentifier ?? "",
            symbolName: current?.symbolName ?? "app",
            tagEdits: edits
        )
        try check(shortcuts().last?.tags.contains("Renamed Tag") == true && !appTags().contains("Brand New Tag"), "Tag rename failed.")
        try store.updateApplicationDetails(
            id: applicationID,
            name: current?.name ?? "",
            bundleIdentifier: current?.bundleIdentifier ?? "",
            symbolName: current?.symbolName ?? "app",
            tagEdits: edits.filter { $0.name != "Renamed Tag" }
        )
        try check(shortcuts().last?.tags.contains("Renamed Tag") == false, "Tag delete did not remove it from shortcuts.")
        let legacy = try JSONDecoder().decode(
            ShortcutItem.self,
            from: Data(#"{"id":"x","title":"T","keys":["A"],"category":"Old"}"#.utf8)
        )
        try check(legacy.tags == ["Old"], "Legacy category was not migrated to a tag.")

        // Search: keyword, tags and key combination all narrow the visible rows.
        try store.saveShortcut(ShortcutItem(title: "Alpha Find", keys: ["⌘", "J"], tags: ["SrchA", "SrchB"]), applicationID: applicationID)
        try store.saveShortcut(ShortcutItem(title: "Beta", keys: ["⌥", "K"], tags: ["SrchA"]), applicationID: applicationID)
        let total = model.rows.count
        model.searchText = "alpha"
        try check(model.rows.map(\.title) == ["Alpha Find"], "Keyword search by name failed.")
        model.searchText = "srchb"
        try check(model.rows.map(\.title) == ["Alpha Find"], "Keyword search by tag failed.")
        model.searchText = "⌥k"
        try check(model.rows.map(\.title) == ["Beta"], "Keyword search by key combination failed.")
        model.searchText = ""
        model.addSearchTag("srcha")
        try check(model.rows.count == 2 && model.searchTags == ["SrchA"], "Tag filter failed.")
        model.addSearchTag("SrchB")
        try check(model.rows.map(\.title) == ["Alpha Find"], "Multiple tag filter should require all tags.")
        model.clearSearch()
        try check(model.rows.count == total && !model.isSearching, "Clearing search did not restore the list.")
        model.clearSearch()
        model.click(model.rows.last?.id ?? "", field: nil, modifiers: [])
        model.searchText = "alpha"
        try check(model.selection.isEmpty, "Selection was not pruned when filtered out.")
        model.clearSearch()
        model.toggleSearchKeyRecording()
        try check(model.isRecordingSearchKeys, "Key search mode did not start.")
        model.toggleSearchKeyRecording()
        model.clearSearch()
    }

    @MainActor
    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw ShortcutStoreSelfTestError.failed(message) }
    }

    @MainActor
    private static func expectError(
        _ expected: ShortcutStoreError,
        operation: () throws -> Void
    ) throws {
        do {
            try operation()
        } catch let error as ShortcutStoreError {
            try check(error.localizedDescription == expected.localizedDescription, "Unexpected error: \(error)")
            return
        }
        throw ShortcutStoreSelfTestError.failed("Expected error: \(expected.localizedDescription)")
    }
}

private enum ShortcutStoreSelfTestError: LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
