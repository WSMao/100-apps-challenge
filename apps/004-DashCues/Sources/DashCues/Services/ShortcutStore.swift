import Combine
import Foundation

@MainActor
final class ShortcutStore: ObservableObject {
    @Published private(set) var applications: [ShortcutApplication]
    @Published private(set) var hotKey: HotKeyConfiguration

    private let storageURL: URL
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()

    var pinnedApplications: [ShortcutApplication] {
        applications.filter(\.isPinned)
    }

    var otherApplications: [ShortcutApplication] {
        applications.filter { !$0.isPinned }
    }

    private static func pinnedFirst(_ applications: [ShortcutApplication]) -> [ShortcutApplication] {
        applications.filter(\.isPinned) + applications.filter { !$0.isPinned }
    }

    init(storageURL: URL? = nil) throws {
        if let storageURL {
            self.storageURL = storageURL
        } else {
            guard let supportDirectory = FileManager.default.urls(
                for: .applicationSupportDirectory,
                in: .userDomainMask
            ).first else {
                throw ShortcutStoreError.storageUnavailable
            }
            self.storageURL = supportDirectory
                .appendingPathComponent("DashCues", isDirectory: true)
                .appendingPathComponent("shortcuts.json")
        }

        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        if FileManager.default.fileExists(atPath: self.storageURL.path) {
            let snapshot = try decoder.decode(ShortcutStoreSnapshot.self, from: Data(contentsOf: self.storageURL))
            guard ShortcutStoreSnapshot.supportedSchemaVersions.contains(snapshot.schemaVersion) else {
                throw ShortcutStoreError.unsupportedSchema(snapshot.schemaVersion)
            }
            applications = Self.pinnedFirst(snapshot.applications)
            hotKey = snapshot.hotKey
            if snapshot.schemaVersion != ShortcutStoreSnapshot.currentSchemaVersion {
                try persist()
            }
        } else {
            applications = ShortcutCatalog.builtIns
            hotKey = .defaultValue
            try persist()
        }
    }

    func application(id: String) -> ShortcutApplication? {
        applications.first { $0.id == id }
    }

    func searchKeyValueEntries(_ query: String, applicationID: String) -> [KeyValueSearchResult] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, let application = application(id: applicationID) else { return [] }

        return application.keyValueCheatsheets.flatMap { cheatsheet in
            cheatsheet.entries.compactMap { entry in
                guard entry.key.localizedCaseInsensitiveContains(query)
                        || entry.value.localizedCaseInsensitiveContains(query)
                else {
                    return nil
                }
                return KeyValueSearchResult(
                    cheatsheetID: cheatsheet.id,
                    cheatsheetName: cheatsheet.name,
                    entry: entry
                )
            }
        }
    }

    func setPinned(_ isPinned: Bool, applicationID: String) throws {
        guard var app = application(id: applicationID) else {
            throw ShortcutStoreError.applicationNotFound
        }
        guard app.isPinned != isPinned else { return }
        app.isPinned = isPinned
        var updated = applications.filter { $0.id != applicationID }
        // Newly pinned apps go to the very top; unpinned apps go to the top of the unpinned section.
        let insertIndex = isPinned ? 0 : updated.filter(\.isPinned).count
        updated.insert(app, at: insertIndex)
        try commit(applications: updated, hotKey: hotKey)
    }

    func moveApplications(fromOffsets: IndexSet, toOffset: Int) throws {
        var updated = applications
        updated.move(fromOffsets: fromOffsets, toOffset: toOffset)
        try commit(applications: updated, hotKey: hotKey)
    }

    func addApplication(name: String, bundleIdentifier: String, symbolName: String, customIconData: Data? = nil) throws -> String {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ShortcutStoreError.invalidApplication
        }
        guard !applications.contains(where: {
            $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame
        }) else {
            throw ShortcutStoreError.duplicateApplication
        }

        let application = ShortcutApplication(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            bundleIdentifier: bundleIdentifier.trimmingCharacters(in: .whitespacesAndNewlines),
            symbolName: symbolName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "app" : symbolName,
            customIconData: customIconData
        )
        try commit(applications: applications + [application], hotKey: hotKey)
        return application.id
    }

    func updateApplicationDetails(
        id: String,
        name: String,
        bundleIdentifier: String,
        symbolName: String,
        customIconData: Data?? = .none,
        tagEdits: [TagEdit]? = nil
    ) throws {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ShortcutStoreError.invalidApplication
        }
        if let tagEdits {
            let names = tagEdits.map { TagList.key($0.name) }
            guard !names.contains("") else { throw ShortcutStoreError.invalidTag }
            guard Set(names).count == names.count else { throw ShortcutStoreError.duplicateTag }
        }
        if applications.contains(where: {
            $0.id != id && $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame
        }) {
            throw ShortcutStoreError.duplicateApplication
        }
        try updateApplication(id) {
            $0.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
            $0.bundleIdentifier = bundleIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
            $0.symbolName = symbolName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "app" : symbolName
            // .none leaves the icon untouched; .some(nil) removes the custom icon.
            if let customIconData { $0.customIconData = customIconData }
            if let tagEdits { $0.applyTagEdits(tagEdits) }
        }
    }

    func deleteApplication(id: String) throws {
        guard let app = application(id: id) else {
            throw ShortcutStoreError.applicationNotFound
        }
        guard !app.isBuiltIn else {
            throw ShortcutStoreError.builtInApplicationCannotBeDeleted
        }
        try commit(applications: applications.filter { $0.id != id }, hotKey: hotKey)
    }

    func saveShortcut(_ shortcut: ShortcutItem, applicationID: String, sheetID: String? = nil) throws {
        guard !shortcut.isBlank,
              shortcut.keys.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            throw ShortcutStoreError.invalidShortcut
        }
        try updateApplication(applicationID) { app in
            var shortcut = shortcut
            shortcut.tags = app.canonicalTags(shortcut.tags)
            app.saveShortcut(shortcut, sheetID: sheetID)
            app.syncTags()
        }
    }

    func deleteShortcut(id: String, applicationID: String) throws {
        try updateApplication(applicationID) { app in
            app.deleteShortcut(id: id)
        }
    }

    func deleteShortcuts(ids: Set<String>, applicationID: String) throws {
        try updateApplication(applicationID) { app in
            app.deleteShortcuts(ids: ids)
        }
    }

    @discardableResult
    func createKeyValueCheatsheet(name: String, applicationID: String) throws -> String {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedName.isEmpty else { throw ShortcutStoreError.invalidCheatsheetName }
        guard let app = application(id: applicationID) else { throw ShortcutStoreError.applicationNotFound }
        guard !app.sheets.contains(where: {
            Self.cheatsheetNameKey($0.name) == Self.cheatsheetNameKey(cleanedName)
        }) else {
            throw ShortcutStoreError.duplicateCheatsheetName
        }

        let cheatsheet = KeyValueCheatsheet(name: cleanedName)
        try updateApplication(applicationID) { $0.sheets.append(.keyValue(cheatsheet)) }
        return cheatsheet.id
    }

    func renameKeyValueCheatsheet(id: String, name: String, applicationID: String) throws {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedName.isEmpty else { throw ShortcutStoreError.invalidCheatsheetName }
        guard let app = application(id: applicationID) else { throw ShortcutStoreError.applicationNotFound }
        guard app.sheets.contains(where: { $0.id == id && $0.kind == .keyValue }) else {
            throw ShortcutStoreError.cheatsheetNotFound
        }
        guard !app.sheets.contains(where: {
            $0.id != id && Self.cheatsheetNameKey($0.name) == Self.cheatsheetNameKey(cleanedName)
        }) else {
            throw ShortcutStoreError.duplicateCheatsheetName
        }

        try updateApplication(applicationID) { app in
            guard let index = app.sheets.firstIndex(where: { $0.id == id }) else { return }
            guard case .keyValue(var cheatsheet) = app.sheets[index] else { return }
            cheatsheet.name = cleanedName
            app.sheets[index] = .keyValue(cheatsheet)
        }
    }

    func deleteKeyValueCheatsheet(id: String, applicationID: String) throws {
        guard let app = application(id: applicationID) else { throw ShortcutStoreError.applicationNotFound }
        guard app.sheets.contains(where: { $0.id == id && $0.kind == .keyValue }) else {
            throw ShortcutStoreError.cheatsheetNotFound
        }
        try updateApplication(applicationID) { app in
            app.sheets.removeAll { $0.id == id }
        }
    }

    func saveKeyValueEntry(
        _ entry: KeyValueEntry,
        cheatsheetID: String,
        applicationID: String
    ) throws {
        guard !entry.isBlank else { throw ShortcutStoreError.invalidKeyValueEntry }
        try updateKeyValueCheatsheet(cheatsheetID, applicationID: applicationID) { cheatsheet in
            if let index = cheatsheet.entries.firstIndex(where: { $0.id == entry.id }) {
                cheatsheet.entries[index] = entry
            } else {
                cheatsheet.entries.append(entry)
            }
        }
    }

    func deleteKeyValueEntry(id: String, cheatsheetID: String, applicationID: String) throws {
        try updateKeyValueCheatsheet(cheatsheetID, applicationID: applicationID) { cheatsheet in
            cheatsheet.entries.removeAll { $0.id == id }
        }
    }

    func moveKeyValueEntries(
        fromOffsets: IndexSet,
        toOffset: Int,
        cheatsheetID: String,
        applicationID: String
    ) throws {
        try updateKeyValueCheatsheet(cheatsheetID, applicationID: applicationID) { cheatsheet in
            cheatsheet.entries.move(fromOffsets: fromOffsets, toOffset: toOffset)
        }
    }

    func hasDuplicateKey(
        _ key: String,
        cheatsheetID: String,
        applicationID: String,
        excludingEntryID: String? = nil
    ) -> Bool {
        let normalizedKey = key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedKey.isEmpty,
              let cheatsheet = application(id: applicationID)?.keyValueCheatsheets.first(where: { $0.id == cheatsheetID })
        else {
            return false
        }
        return cheatsheet.entries.contains { entry in
            entry.id != excludingEntryID
                && !entry.key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && entry.key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedKey
        }
    }

    func updateHotKey(_ configuration: HotKeyConfiguration) throws {
        try commit(applications: applications, hotKey: configuration)
    }

    func exportBackup(to url: URL) throws {
        try encoder.encode(snapshot()).write(to: url, options: .atomic)
    }

    func restoreBackup(from url: URL) throws {
        let imported = try decoder.decode(ShortcutStoreSnapshot.self, from: Data(contentsOf: url))
        guard ShortcutStoreSnapshot.supportedSchemaVersions.contains(imported.schemaVersion) else {
            throw ShortcutStoreError.unsupportedSchema(imported.schemaVersion)
        }
        try validateBackup(imported)
        try commit(applications: imported.applications, hotKey: imported.hotKey)
    }

    private func updateApplication(
        _ id: String,
        update: (inout ShortcutApplication) -> Void
    ) throws {
        var updatedApplications = applications
        guard let index = updatedApplications.firstIndex(where: { $0.id == id }) else {
            throw ShortcutStoreError.applicationNotFound
        }
        update(&updatedApplications[index])
        try commit(applications: updatedApplications, hotKey: hotKey)
    }

    private func updateKeyValueCheatsheet(
        _ cheatsheetID: String,
        applicationID: String,
        update: (inout KeyValueCheatsheet) -> Void
    ) throws {
        guard let app = application(id: applicationID) else { throw ShortcutStoreError.applicationNotFound }
        guard let index = app.sheets.firstIndex(where: { $0.id == cheatsheetID && $0.kind == .keyValue }) else {
            throw ShortcutStoreError.cheatsheetNotFound
        }
        try updateApplication(applicationID) { app in
            guard case .keyValue(var cheatsheet) = app.sheets[index] else { return }
            update(&cheatsheet)
            app.sheets[index] = .keyValue(cheatsheet)
        }
    }

    private static func cheatsheetNameKey(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func snapshot(
        applications: [ShortcutApplication]? = nil,
        hotKey: HotKeyConfiguration? = nil
    ) -> ShortcutStoreSnapshot {
        ShortcutStoreSnapshot(
            schemaVersion: ShortcutStoreSnapshot.currentSchemaVersion,
            applications: applications ?? self.applications,
            hotKey: hotKey ?? self.hotKey
        )
    }

    private func commit(
        applications newApplications: [ShortcutApplication],
        hotKey newHotKey: HotKeyConfiguration
    ) throws {
        let oldApplications = applications
        let oldHotKey = hotKey
        applications = Self.pinnedFirst(newApplications)
        hotKey = newHotKey
        do {
            try persist()
        } catch {
            applications = oldApplications
            hotKey = oldHotKey
            throw error
        }
    }

    private func persist() throws {
        let directory = storageURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try encoder.encode(snapshot()).write(to: storageURL, options: .atomic)
    }

    private func validateBackup(_ snapshot: ShortcutStoreSnapshot) throws {
        let applicationIDs = snapshot.applications.map(\.id)
        let applicationNames = snapshot.applications.map { $0.name.lowercased() }
        let allowedModifiers = HotKeyModifiers.command
            | HotKeyModifiers.shift
            | HotKeyModifiers.option
            | HotKeyModifiers.control
        let hotKeyIsValid = snapshot.hotKey.keyCode <= 127
            && snapshot.hotKey.modifiers != 0
            && snapshot.hotKey.modifiers & ~allowedModifiers == 0

        guard hotKeyIsValid,
              Set(applicationIDs).count == applicationIDs.count,
              Set(applicationNames).count == applicationNames.count,
              snapshot.applications.allSatisfy({ application in
                  !application.id.isEmpty
                      && !application.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                      && Set(application.shortcuts.map(\.id)).count == application.shortcuts.count
                      && application.shortcuts.allSatisfy { shortcut in
                          !shortcut.id.isEmpty
                              && !shortcut.isBlank
                              && shortcut.keys.allSatisfy {
                                  !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              }
                      }
                      && Set(application.sheets.map(\.id)).count == application.sheets.count
                      && Set(application.sheets.map { Self.cheatsheetNameKey($0.name) }).count
                          == application.sheets.count
                      && application.sheets.allSatisfy {
                          !$0.id.isEmpty && !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                      }
                      && application.keyValueCheatsheets.allSatisfy { cheatsheet in
                          !cheatsheet.id.isEmpty
                              && !cheatsheet.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              && Set(cheatsheet.entries.map(\.id)).count == cheatsheet.entries.count
                              && cheatsheet.entries.allSatisfy {
                              !$0.id.isEmpty && !$0.isBlank
                              }
                      }
              }) else {
            throw ShortcutStoreError.invalidBackup
        }
    }
}
