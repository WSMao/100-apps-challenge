import Foundation

enum ShortcutStoreSelfTest {
    @MainActor
    static func run() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("DashCuesSelfTest-\(UUID().uuidString)", isDirectory: true)
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

        try expectError(ShortcutStoreError.builtInApplicationCannotBeDeleted) {
            try reopenedStore.deleteApplication(id: "com.apple.finder")
        }
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

        try reopenedStore.exportBackup(to: backupURL)
        try reopenedStore.deleteApplication(id: appID)
        try check(reopenedStore.application(id: appID) == nil, "App deletion did not work.")
        try reopenedStore.restoreBackup(from: backupURL)
        try check(reopenedStore.application(id: appID) != nil, "Backup restore did not restore app data.")

        print("DashCues self-test passed.")
    }

    @MainActor
    private static func runPopoverNavigationChecks(store: ShortcutStore) throws {
        var opened = 0
        var closed = 0
        let nav = PopoverNavigation(store: store, onOpenDashboard: { opened += 1 }, onClose: { closed += 1 })
        let ids = (store.pinnedApplications + store.otherApplications).map(\.id)
        try check(nav.searchFocused && !nav.focusOnOpenButton, "Popover should focus the search field first.")
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
